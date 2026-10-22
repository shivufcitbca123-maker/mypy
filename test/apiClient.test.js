import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, apiRequest } from '../src/api/client.js'

test('sends JSON requests with same-origin session credentials', async () => {
  const originalFetch = globalThis.fetch
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return new Response(JSON.stringify({ user: { role: 'admin' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const payload = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email: 'admin@example.edu' },
    })
    assert.equal(request.url, '/api/auth/login')
    assert.equal(request.options.credentials, 'include')
    assert.equal(request.options.headers.get('Content-Type'), 'application/json')
    assert.deepEqual(JSON.parse(request.options.body), { email: 'admin@example.edu' })
    assert.deepEqual(payload, { user: { role: 'admin' } })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('surfaces API errors instead of returning a successful fallback', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Not authorized.' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })

  try {
    await assert.rejects(apiRequest('/students'), (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 403)
      assert.equal(error.message, 'Not authorized.')
      return true
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})
