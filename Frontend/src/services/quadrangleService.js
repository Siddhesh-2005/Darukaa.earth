const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  return response.status === 204 ? null : response.json()
}

function normalizeQuadrangle(item) {
  return {
    ...item,
    coordinates: item.coordinates || item.geometry?.coordinates?.[0]?.slice(0, -1) || [],
  }
}

export async function getQuadrangles(district) {
  const result = await request(`/api/quadrangles?district=${encodeURIComponent(district)}`)
  const items = Array.isArray(result) ? result : result?.data || result?.quadrangles || []
  return items.map(normalizeQuadrangle)
}

export async function createQuadrangle(data) {
  const result = await request('/api/quadrangles', { method: 'POST', body: JSON.stringify(data) })
  return result ? normalizeQuadrangle(result.data || result) : null
}

export async function deleteQuadrangle(id) {
  return request(`/api/quadrangles/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
