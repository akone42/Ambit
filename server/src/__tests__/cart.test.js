import request from 'supertest'
import app from '../app.js'
import { pool } from '../db/pool.js'

function uniqueId() {
  return `${Date.now()}${Math.floor(Math.random() * 10000)}`
}

function createUser(overrides = {}) {
  const unique = uniqueId()

  return {
    email: `test-${unique}@example.com`,
    username: `testuser${unique}`,
    password: 'password123',
    ...overrides,
  }
}

async function registerUser(agent, overrides = {}) {
  const user = createUser(overrides)
  const res = await agent.post('/api/auth/register').send(user)

  return { user, res }
}

async function registerSeller(agent, overrides = {}) {
  const { user } = await registerUser(agent, overrides)

  await pool.query('UPDATE users SET role = $1 WHERE email = $2', ['seller', user.email])

  await agent.post('/api/auth/login').send({
    email: user.email,
    password: user.password,
  })

  return user
}

function createStorefrontPayload(overrides = {}) {
  const unique = uniqueId()

  return {
    display_name: `Test Storefront ${unique}`,
    slug: `test-storefront-${unique}`,
    bio: 'Test storefront bio',
    avatar_url: 'https://example.com/storefront.png',
    ...overrides,
  }
}

function createProductListingPayload(overrides = {}) {
  const unique = uniqueId()

  return {
    type: 'product',
    title: `Test Product Listing ${unique}`,
    description: 'Test product description',
    price: 25.99,
    category: 'crafts',
    inventory_count: 10,
    ...overrides,
  }
}

async function createSellerStorefrontAndListing() {
  const sellerAgent = request.agent(app)

  await registerSeller(sellerAgent)

  const storefrontRes = await sellerAgent.post('/api/storefronts').send(createStorefrontPayload())

  const listingRes = await sellerAgent.post('/api/listings').send(createProductListingPayload())

  return {
    sellerAgent,
    storefront: storefrontRes.body.storefront,
    listing: listingRes.body.listing,
  }
}

describe('Cart routes', () => {
  beforeEach(async () => {
    await pool.query(`
      DELETE FROM reviews
      WHERE listing_id IN (
        SELECT id FROM listings
        WHERE title LIKE 'Test %'
           OR title LIKE 'Updated %'
      )
    `)

    await pool.query(`
      DELETE FROM order_items
      WHERE listing_id IN (
        SELECT id FROM listings
        WHERE title LIKE 'Test %'
           OR title LIKE 'Updated %'
      )
    `)

    await pool.query(`
      DELETE FROM cart_items
      WHERE listing_id IN (
        SELECT id FROM listings
        WHERE title LIKE 'Test %'
           OR title LIKE 'Updated %'
      )
    `)

    await pool.query(`
      DELETE FROM orders
      WHERE buyer_id IN (
        SELECT id FROM users
        WHERE email LIKE 'test%@example.com'
      )
    `)

    await pool.query(`
      DELETE FROM listings
      WHERE title LIKE 'Test %'
         OR title LIKE 'Updated %'
    `)

    await pool.query(`DELETE FROM storefronts WHERE slug LIKE 'test-%' `)
    await pool.query(`DELETE FROM users WHERE email LIKE 'test%@example.com'`)
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('GET /api/cart', () => {
    test('returns 401 when not logged in', async () => {
      const res = await request(app).get('/api/cart')

      expect(res.status).toBe(401)
    })

    test('returns only the logged-in user cart items', async () => {
      const { listing } = await createSellerStorefrontAndListing()

      const firstUserAgent = request.agent(app)
      const secondUserAgent = request.agent(app)

      await registerUser(firstUserAgent)
      await registerUser(secondUserAgent)

      await firstUserAgent.post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 2,
      })

      const firstUserCart = await firstUserAgent.get('/api/cart')
      const secondUserCart = await secondUserAgent.get('/api/cart')

      expect(firstUserCart.status).toBe(200)
      expect(firstUserCart.body.items).toHaveLength(1)
      expect(firstUserCart.body.items[0].listing_id).toBe(listing.id)
      expect(firstUserCart.body.items[0].quantity).toBe(2)

      expect(secondUserCart.status).toBe(200)
      expect(secondUserCart.body.items).toHaveLength(0)
    })
  })

  describe('POST /api/cart/items', () => {
    test('returns 401 when not logged in', async () => {
      const { listing } = await createSellerStorefrontAndListing()

      const res = await request(app).post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 1,
      })

      expect(res.status).toBe(401)
    })

    test('adds a product listing to the logged-in user cart', async () => {
      const { listing } = await createSellerStorefrontAndListing()

      const buyerAgent = request.agent(app)
      await registerUser(buyerAgent)

      const res = await buyerAgent.post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 3,
      })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('item')
      expect(res.body.item.listing_id).toBe(listing.id)
      expect(res.body.item.quantity).toBe(3)
    })

    test('adds quantity when the same item is added again', async () => {
      const { listing } = await createSellerStorefrontAndListing()

      const buyerAgent = request.agent(app)
      await registerUser(buyerAgent)

      await buyerAgent.post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 2,
      })

      const res = await buyerAgent.post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 3,
      })

      expect(res.status).toBe(201)
      expect(res.body.item.quantity).toBe(5)
    })

    test('rejects missing listingId', async () => {
      const buyerAgent = request.agent(app)
      await registerUser(buyerAgent)

      const res = await buyerAgent.post('/api/cart/items').send({
        quantity: 1,
      })

      expect(res.status).toBe(400)
    })
  })

  describe('PUT /api/cart/items/:listingId', () => {
    test('updates the quantity of a cart item', async () => {
      const { listing } = await createSellerStorefrontAndListing()

      const buyerAgent = request.agent(app)
      await registerUser(buyerAgent)

      await buyerAgent.post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 1,
      })

      const res = await buyerAgent.put(`/api/cart/items/${listing.id}`).send({
        quantity: 4,
      })

      expect(res.status).toBe(200)
      expect(res.body.item.listing_id).toBe(listing.id)
      expect(res.body.item.quantity).toBe(4)
    })

    test('rejects invalid quantity', async () => {
      const { listing } = await createSellerStorefrontAndListing()

      const buyerAgent = request.agent(app)
      await registerUser(buyerAgent)

      const res = await buyerAgent.put(`/api/cart/items/${listing.id}`).send({
        quantity: 0,
      })

      expect(res.status).toBe(400)
    })
  })

  describe('DELETE /api/cart/items/:listingId', () => {
    test('removes only the logged-in user cart item', async () => {
      const { listing } = await createSellerStorefrontAndListing()

      const firstUserAgent = request.agent(app)
      const secondUserAgent = request.agent(app)

      await registerUser(firstUserAgent)
      await registerUser(secondUserAgent)

      await firstUserAgent.post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 1,
      })

      await secondUserAgent.post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 1,
      })

      const deleteRes = await firstUserAgent.delete(`/api/cart/items/${listing.id}`)

      expect(deleteRes.status).toBe(204)

      const firstUserCart = await firstUserAgent.get('/api/cart')
      const secondUserCart = await secondUserAgent.get('/api/cart')

      expect(firstUserCart.body.items).toHaveLength(0)
      expect(secondUserCart.body.items).toHaveLength(1)
      expect(secondUserCart.body.items[0].listing_id).toBe(listing.id)
    })
  })
})
