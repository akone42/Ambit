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

async function createSellerWithStorefront(agent) {
  await registerSeller(agent)

  const storefrontPayload = createStorefrontPayload()
  const storefrontRes = await agent.post('/api/storefronts').send(storefrontPayload)

  return storefrontRes.body.storefront
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

function createServiceListingPayload(overrides = {}) {
  const unique = uniqueId()

  return {
    type: 'service',
    title: `Test Service Listing ${unique}`,
    description: 'Test service description',
    price: 50,
    category: 'lessons',
    delivery_window_days: 7,
    ...overrides,
  }
}

describe('Listing routes', () => {
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

  describe('POST /api/listings', () => {
    test('creates a product listing for a seller with a storefront', async () => {
      const agent = request.agent(app)
      const storefront = await createSellerWithStorefront(agent)

      const payload = createProductListingPayload()

      const res = await agent.post('/api/listings').send(payload)

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('listing')
      expect(res.body.listing.title).toBe(payload.title)
      expect(res.body.listing.type).toBe('product')
      expect(Number(res.body.listing.price)).toBe(Number(payload.price))
      expect(res.body.listing.category).toBe(payload.category)
      expect(res.body.listing.inventory_count).toBe(payload.inventory_count)
      expect(res.body.listing.storefront_id).toBe(storefront.id)
    })

    test('creates a service listing for a seller with a storefront', async () => {
      const agent = request.agent(app)
      const storefront = await createSellerWithStorefront(agent)

      const payload = createServiceListingPayload()

      const res = await agent.post('/api/listings').send(payload)

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('listing')
      expect(res.body.listing.title).toBe(payload.title)
      expect(res.body.listing.type).toBe('service')
      expect(Number(res.body.listing.price)).toBe(Number(payload.price))
      expect(res.body.listing.category).toBe(payload.category)
      expect(res.body.listing.delivery_window_days).toBe(payload.delivery_window_days)
      expect(res.body.listing.storefront_id).toBe(storefront.id)
    })

    test('returns 403 for buyer without seller role', async () => {
      const agent = request.agent(app)
      await registerUser(agent)

      const payload = createProductListingPayload()

      const res = await agent.post('/api/listings').send(payload)

      expect(res.status).toBe(403)
    })

    test('returns 401 when not logged in', async () => {
      const payload = createProductListingPayload()

      const res = await request(app).post('/api/listings').send(payload)

      expect(res.status).toBe(401)
    })

    test('returns 400 when seller has no storefront', async () => {
      const agent = request.agent(app)
      await registerSeller(agent)

      const payload = createProductListingPayload()

      const res = await agent.post('/api/listings').send(payload)

      expect(res.status).toBe(400)
      expect(res.body).toHaveProperty('error')
    })
  })

  describe('GET /api/listings', () => {
    test('returns active listings publicly', async () => {
      const agent = request.agent(app)
      await createSellerWithStorefront(agent)

      const payload = createProductListingPayload()
      await agent.post('/api/listings').send(payload)

      const res = await request(app).get('/api/listings')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('listings')
      expect(Array.isArray(res.body.listings)).toBe(true)

      const createdListing = res.body.listings.find((listing) => listing.title === payload.title)
      expect(createdListing).toBeDefined()
    })

    test('filters listings by category', async () => {
      const agent = request.agent(app)
      await createSellerWithStorefront(agent)

      const payload = createProductListingPayload({
        title: `Test Category Listing ${uniqueId()}`,
        category: 'test-category',
      })

      await agent.post('/api/listings').send(payload)

      const res = await request(app).get('/api/listings?category=test-category')

      expect(res.status).toBe(200)
      expect(res.body.listings.length).toBeGreaterThanOrEqual(1)
      expect(res.body.listings.every((listing) => listing.category === 'test-category')).toBe(true)
    })

    test('filters listings by storefront_id', async () => {
      const agent = request.agent(app)
      const storefront = await createSellerWithStorefront(agent)

      const payload = createProductListingPayload()
      await agent.post('/api/listings').send(payload)

      const res = await request(app).get(`/api/listings?storefront_id=${storefront.id}`)

      expect(res.status).toBe(200)
      expect(res.body.listings.length).toBeGreaterThanOrEqual(1)
      expect(res.body.listings.every((listing) => listing.storefront_id === storefront.id)).toBe(
        true
      )
    })
  })

  describe('GET /api/listings/:id', () => {
    test('returns listing detail publicly', async () => {
      const agent = request.agent(app)
      await createSellerWithStorefront(agent)

      const payload = createProductListingPayload()
      const createRes = await agent.post('/api/listings').send(payload)

      const listingId = createRes.body.listing.id

      const res = await request(app).get(`/api/listings/${listingId}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('listing')
      expect(res.body.listing.id).toBe(listingId)
      expect(res.body.listing.title).toBe(payload.title)
      expect(res.body.listing).toHaveProperty('storefront_name')
      expect(res.body.listing).toHaveProperty('storefront_slug')
    })

    test('returns 404 for missing listing', async () => {
      const res = await request(app).get('/api/listings/00000000-0000-0000-0000-000000000000')

      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/listings/:id', () => {
    test('allows owner to update listing', async () => {
      const agent = request.agent(app)
      await createSellerWithStorefront(agent)

      const payload = createProductListingPayload()
      const createRes = await agent.post('/api/listings').send(payload)

      const listingId = createRes.body.listing.id

      const res = await agent.put(`/api/listings/${listingId}`).send({
        title: 'Updated Product Listing',
        price: 30.5,
        inventory_count: 5,
      })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('listing')
      expect(res.body.listing.title).toBe('Updated Product Listing')
      expect(Number(res.body.listing.price)).toBe(30.5)
      expect(res.body.listing.inventory_count).toBe(5)
    })

    test('rejects non-owner update with 403', async () => {
      const ownerAgent = request.agent(app)
      const otherAgent = request.agent(app)

      await createSellerWithStorefront(ownerAgent)
      await registerSeller(otherAgent)

      const payload = createProductListingPayload()
      const createRes = await ownerAgent.post('/api/listings').send(payload)

      const listingId = createRes.body.listing.id

      const res = await otherAgent.put(`/api/listings/${listingId}`).send({
        title: 'Updated By Wrong User',
      })

      expect(res.status).toBe(403)
    })

    test('returns 401 when not logged in', async () => {
      const res = await request(app)
        .put('/api/listings/00000000-0000-0000-0000-000000000000')
        .send({
          title: 'Should Not Update',
        })

      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /api/listings/:id', () => {
    test('soft deletes owner listing', async () => {
      const agent = request.agent(app)
      await createSellerWithStorefront(agent)

      const payload = createProductListingPayload()
      const createRes = await agent.post('/api/listings').send(payload)

      const listingId = createRes.body.listing.id

      const res = await agent.delete(`/api/listings/${listingId}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('message', 'Listing deleted')

      const detailRes = await request(app).get(`/api/listings/${listingId}`)
      expect(detailRes.status).toBe(404)
    })

    test('rejects non-owner delete with 403', async () => {
      const ownerAgent = request.agent(app)
      const otherAgent = request.agent(app)

      await createSellerWithStorefront(ownerAgent)
      await registerSeller(otherAgent)

      const payload = createProductListingPayload()
      const createRes = await ownerAgent.post('/api/listings').send(payload)

      const listingId = createRes.body.listing.id

      const res = await otherAgent.delete(`/api/listings/${listingId}`)

      expect(res.status).toBe(403)
    })

    test('returns 401 when not logged in', async () => {
      const res = await request(app).delete('/api/listings/00000000-0000-0000-0000-000000000000')

      expect(res.status).toBe(401)
    })
  })
})
