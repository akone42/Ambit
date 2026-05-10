import request from 'supertest'
import app from '../app.js'
import { pool } from '../db/pool.js'

function createUser(overrides = {}) {
  const unique = Date.now()

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

describe('Auth routes', () => {
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

  describe('POST /api/auth/register', () => {
    test('creates a user and returns safe user data', async () => {
      const agent = request.agent(app)

      const { user, res } = await registerUser(agent)

      expect(res.status).toBe(201)
      expect(res.body.user.email).toBe(user.email)
      expect(res.body.user.username).toBe(user.username)
      expect(res.body.user).not.toHaveProperty('password')
    })

    test('rejects duplicate email', async () => {
      const agent = request.agent(app)
      const user = createUser({
        email: 'test-duplicate@example.com',
        username: 'testduplicate1',
      })

      await agent.post('/api/auth/register').send(user)

      const res = await agent.post('/api/auth/register').send({
        ...user,
        username: 'testduplicate2',
      })

      expect(res.status).toBe(409)
    })
  })

  describe('POST /api/auth/login', () => {
    test('logs in with valid credentials and returns safe user data', async () => {
      const agent = request.agent(app)
      const { user } = await registerUser(agent)

      const res = await request(app).post('/api/auth/login').send({
        email: user.email,
        password: user.password,
      })

      expect(res.status).toBe(200)
      expect(res.headers['set-cookie']).toBeDefined()
      expect(res.body.user.email).toBe(user.email)
      expect(res.body.user).not.toHaveProperty('password')
    })

    test('rejects wrong password', async () => {
      const agent = request.agent(app)
      const { user } = await registerUser(agent)

      const res = await request(app).post('/api/auth/login').send({
        email: user.email,
        password: 'wrongpassword',
      })

      expect(res.status).toBe(401)
    })
  })
  describe('POST /api/auth/logout', () => {
    test('clears the auth cookie', async () => {
      const agent = request.agent(app)

      await registerUser(agent)

      const res = await agent.post('/api/auth/logout')

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('message', 'Logged out')
      expect(res.headers['set-cookie']).toBeDefined()

      const cookieHeader = res.headers['set-cookie'].join('; ')

      expect(cookieHeader).toContain('token=')
      expect(cookieHeader).toMatch(/Max-Age=0|Expires=/)
    })
  })

  describe('GET /api/auth/me', () => {
    test('returns current user when logged in', async () => {
      const agent = request.agent(app)
      const { user } = await registerUser(agent)

      const res = await agent.get('/api/auth/me')

      expect(res.status).toBe(200)
      expect(res.body.user.email).toBe(user.email)
      expect(res.body.user).not.toHaveProperty('password')
    })

    test('returns 401 when not logged in', async () => {
      const res = await request(app).get('/api/auth/me')

      expect(res.status).toBe(401)
    })
  })

  describe('PUT /api/auth/me', () => {
    test('updates profile when logged in', async () => {
      const agent = request.agent(app)

      await registerUser(agent)

      const res = await agent.put('/api/auth/me').send({
        display_name: 'Updated Test User',
        bio: 'Updated bio from test',
        avatar_url: 'https://example.com/avatar.png',
        saved_shipping_address: {
          street: '123 Test Street',
          city: 'Brooklyn',
          state: 'NY',
          zip: '11201',
          country: 'US',
        },
      })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('user')
      expect(res.body.user.display_name).toBe('Updated Test User')
      expect(res.body.user.bio).toBe('Updated bio from test')
      expect(res.body.user.avatar_url).toBe('https://example.com/avatar.png')
      expect(res.body.user.saved_shipping_address).toMatchObject({
        street: '123 Test Street',
        city: 'Brooklyn',
        state: 'NY',
        zip: '11201',
        country: 'US',
      })
      expect(res.body.user).not.toHaveProperty('password')
    })
    test('returns 401 when not logged in', async () => {
      const res = await request(app).put('/api/auth/me').send({
        display_name: 'Should Not Update',
      })

      expect(res.status).toBe(401)
    })
  })
})
