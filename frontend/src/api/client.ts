import axios from 'axios'
import { useSessionStore } from '../stores/sessionStore'

// In production (GitHub Pages) VITE_API_BASE_URL must point to the Render backend.
// It should include the /api suffix, e.g. https://probe-adjust-api.onrender.com/api
// If the /api suffix is accidentally omitted, we add it automatically.
// In development the Vite proxy rewrites /api → http://localhost:8000/api
function resolveBaseURL(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  if (!raw) return '/api'
  // Normalise: strip trailing slash, then ensure /api suffix
  const stripped = raw.replace(/\/+$/, '')
  return stripped.endsWith('/api') ? stripped : `${stripped}/api`
}

const baseURL = resolveBaseURL()

const client = axios.create({ baseURL })

// Attach X-Session-ID header to every request for interaction logging
client.interceptors.request.use(config => {
  const sessionId = useSessionStore.getState().sessionId
  if (sessionId) config.headers['X-Session-ID'] = sessionId
  return config
})

export default client
