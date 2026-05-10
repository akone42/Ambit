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

describe('Storefront routes', () => {
  beforeEach(async () => {
    await pool.query(`
    DELETE FROM cart_items
    WHERE listing_id IN (
      SELECT id FROM listings
      WHERE title LIKE 'Test %'
         OR title LIKE 'Updated %'
    )
  `)

    await pool.query(`
    DELETE FROM listings
    WHERE title LIKE 'Test %'
       OR title LIKE 'Updated %'
  `)

    await pool.query(`DELETE FROM storefronts WHERE slug LIKE 'test-%'`)
    await pool.query(`DELETE FROM users WHERE email LIKE 'test%@example.com'`)
  })

  afterAll(async () => {
    await pool.end()
  })

  describe('POST /api/storefronts', () => {
    test('creates a storefront for a seller', async () => {
      const agent = request.agent(app)
      await registerSeller(agent)

      const payload = createStorefrontPayload()

      const res = await agent.post('/api/storefronts').send(payload)

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('storefront')
      expect(res.body.storefront.slug).toBe(payload.slug)
      expect(res.body.storefront.display_name).toBe(payload.display_name)
      expect(res.body.storefront.bio).toBe(payload.bio)
    })

    test('allows a logged-in buyer to create a storefront (becomes seller)', async () => {
      const agent = request.agent(app)
      await registerUser(agent)

      const payload = createStorefrontPayload()

      const res = await agent.post('/api/storefronts').send(payload)

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('storefront')
      expect(res.body.storefront.slug).toBe(payload.slug)
    })

    test('returns 401 when not logged in', async () => {
      const payload = createStorefrontPayload()

      const res = await request(app).post('/api/storefronts').send(payload)

      expect(res.status).toBe(401)
    })

    test('rejects duplicate slug with 409', async () => {
      const firstAgent = request.agent(app)
      const secondAgent = request.agent(app)

      await registerSeller(firstAgent)
      await registerSeller(secondAgent)

      const payload = createStorefrontPayload({
        slug: 'test-duplicate-slug',
      })

      await firstAgent.post('/api/storefronts').send(payload)

      const res = await secondAgent.post('/api/storefronts').send({
        ...payload,
        display_name: 'Test Storefront Duplicate',
      })

      expect(res.status).toBe(409)
      expect(res.body).toHaveProperty('errors')
      expect(res.body.errors).toHaveProperty('slug')
    })
  })

  describe('GET /api/storefronts/my', () => {
    test('returns seller storefront', async () => {
      const agent = request.agent(app)
      await registerSeller(agent)

      const payload = createStorefrontPayload()
      await agent.post('/api/storefronts').send(payload)

      const res = await agent.get('/api/storefronts/my')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('storefront')
      expect(res.body.storefront.slug).toBe(payload.slug)
    })

    test('returns null storefront for buyer with no storefront yet', async () => {
      const agent = request.agent(app)
      await registerUser(agent)

      const res = await agent.get('/api/storefronts/my')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('storefront')
      expect(res.body.storefront).toBeNull()
    })
  })

  describe('GET /api/storefronts/slug/:slug', () => {
    test('returns public storefront by slug', async () => {
      const agent = request.agent(app)
      await registerSeller(agent)

      const payload = createStorefrontPayload()
      await agent.post('/api/storefronts').send(payload)

      const res = await request(app).get(`/api/storefronts/slug/${payload.slug}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('storefront')
      expect(res.body.storefront.slug).toBe(payload.slug)
      expect(res.body.storefront.display_name).toBe(payload.display_name)
    })

    test('returns 404 for missing storefront slug', async () => {
      const res = await request(app).get('/api/storefronts/slug/test-missing-storefront')

      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/storefronts/:id', () => {
    test('allows owner to update storefront', async () => {
      const agent = request.agent(app)
      await registerSeller(agent)

      const payload = createStorefrontPayload()
      const createRes = await agent.post('/api/storefronts').send(payload)

      const storefrontId = createRes.body.storefront.id

      const res = await agent.put(`/api/storefronts/${storefrontId}`).send({
        display_name: 'Updated Storefront Name',
        bio: 'Updated storefront bio',
        avatar_url: 'https://example.com/updated-storefront.png',
      })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('storefront')
      expect(res.body.storefront.display_name).toBe('Updated Storefront Name')
      expect(res.body.storefront.bio).toBe('Updated storefront bio')
      expect(res.body.storefront.avatar_url).toBe('https://example.com/updated-storefront.png')
    })

    test('rejects non-owner update with 403', async () => {
      const ownerAgent = request.agent(app)
      const otherAgent = request.agent(app)

      await registerSeller(ownerAgent)
      await registerSeller(otherAgent)

      const payload = createStorefrontPayload()
      const createRes = await ownerAgent.post('/api/storefronts').send(payload)

      const storefrontId = createRes.body.storefront.id

      const res = await otherAgent.put(`/api/storefronts/${storefrontId}`).send({
        display_name: 'Updated By Wrong User',
      })

      expect(res.status).toBe(403)
    })

    test('returns 401 when not logged in', async () => {
      const res = await request(app).put('/api/storefronts/some-id').send({
        display_name: 'Should Not Update',
      })

      expect(res.status).toBe(401)
    })
  })
})
