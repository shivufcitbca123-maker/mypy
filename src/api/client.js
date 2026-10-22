export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers)
  if (options.body !== undefined) headers.set('Content-Type', 'application/json')

  let response
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError('The campus service is unavailable. Start the local API and try again.', 0)
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload
      ? payload.error
      : `The campus service returned HTTP ${response.status}.`
    throw new ApiError(message, response.status)
  }

  return payload
}
