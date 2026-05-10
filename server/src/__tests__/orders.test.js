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
    price: 25,
    category: 'crafts',
    inventory_count: 10,
    ...overrides,
  }
}

async function createSellerStorefrontAndListing(listingOverrides = {}) {
  const sellerAgent = request.agent(app)

  await registerSeller(sellerAgent)

  const storefrontRes = await sellerAgent.post('/api/storefronts').send(createStorefrontPayload())

  const listingRes = await sellerAgent
    .post('/api/listings')
    .send(createProductListingPayload(listingOverrides))

  return {
    sellerAgent,
    storefront: storefrontRes.body.storefront,
    listing: listingRes.body.listing,
  }
}

function shippingAddress() {
  return {
    name: 'Test Buyer',
    street: '123 Test Street',
    city: 'Brooklyn',
    state: 'NY',
    zip: '11201',
  }
}

describe('Order routes', () => {
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

  describe('POST /api/orders', () => {
    test('returns 401 when not logged in', async () => {
      const res = await request(app).post('/api/orders').send({
        shippingAddress: shippingAddress(),
      })

      expect(res.status).toBe(401)
    })

    test('creates an order from the logged-in user cart', async () => {
      const { listing } = await createSellerStorefrontAndListing()

      const buyerAgent = request.agent(app)
      await registerUser(buyerAgent)

      await buyerAgent.post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 2,
      })

      const res = await buyerAgent.post('/api/orders').send({
        shippingAddress: shippingAddress(),
      })

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('order')
      expect(res.body.order.order_type).toBe('product')
      expect(Number(res.body.order.total)).toBe(50)
      expect(res.body.order.status).toBe('pending')
    })

    test('clears the cart after creating an order', async () => {
      const { listing } = await createSellerStorefrontAndListing()

      const buyerAgent = request.agent(app)
      await registerUser(buyerAgent)

      await buyerAgent.post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 1,
      })

      await buyerAgent.post('/api/orders').send({
        shippingAddress: shippingAddress(),
      })

      const cartRes = await buyerAgent.get('/api/cart')

      expect(cartRes.status).toBe(200)
      expect(cartRes.body.items).toHaveLength(0)
    })

    test('decreases product inventory after order is created', async () => {
      const { listing } = await createSellerStorefrontAndListing({
        inventory_count: 10,
      })

      const buyerAgent = request.agent(app)
      await registerUser(buyerAgent)

      await buyerAgent.post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 3,
      })

      await buyerAgent.post('/api/orders').send({
        shippingAddress: shippingAddress(),
      })

      const listingRes = await request(app).get(`/api/listings/${listing.id}`)

      expect(listingRes.status).toBe(200)
      expect(listingRes.body.listing.inventory_count).toBe(7)
    })

    test('returns 400 when cart is empty', async () => {
      const buyerAgent = request.agent(app)
      await registerUser(buyerAgent)

      const res = await buyerAgent.post('/api/orders').send({
        shippingAddress: shippingAddress(),
      })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    test('returns 400 when shipping address is missing', async () => {
      const buyerAgent = request.agent(app)
      await registerUser(buyerAgent)

      const res = await buyerAgent.post('/api/orders').send({})

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })

    test('returns 400 when cart quantity exceeds inventory', async () => {
      const { listing } = await createSellerStorefrontAndListing({
        inventory_count: 1,
      })

      const buyerAgent = request.agent(app)
      await registerUser(buyerAgent)

      await buyerAgent.post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 3,
      })

      const res = await buyerAgent.post('/api/orders').send({
        shippingAddress: shippingAddress(),
      })

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })
  })

  describe('GET /api/orders/my', () => {
    test('returns 401 when not logged in', async () => {
      const res = await request(app).get('/api/orders/my')

      expect(res.status).toBe(401)
    })

    test('returns only the logged-in user orders', async () => {
      const { listing } = await createSellerStorefrontAndListing()

      const firstBuyerAgent = request.agent(app)
      const secondBuyerAgent = request.agent(app)

      await registerUser(firstBuyerAgent)
      await registerUser(secondBuyerAgent)

      await firstBuyerAgent.post('/api/cart/items').send({
        listingId: listing.id,
        quantity: 1,
      })

      await firstBuyerAgent.post('/api/orders').send({
        shippingAddress: shippingAddress(),
      })

      const firstBuyerOrders = await firstBuyerAgent.get('/api/orders/my')
      const secondBuyerOrders = await secondBuyerAgent.get('/api/orders/my')

      expect(firstBuyerOrders.status).toBe(200)
      expect(firstBuyerOrders.body.orders).toHaveLength(1)
      expect(firstBuyerOrders.body.orders[0]).toHaveProperty('items')
      expect(firstBuyerOrders.body.orders[0].items[0].listing_id).toBe(listing.id)

      expect(secondBuyerOrders.status).toBe(200)
      expect(secondBuyerOrders.body.orders).toHaveLength(0)
    })
  })
})
