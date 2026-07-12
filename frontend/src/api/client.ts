import axios from 'axios'
import { useSessionStore } from '../stores/sessionStore'

// In production (GitHub Pages) VITE_API_BASE_URL must be set to the Render
// backend URL, e.g. https://probe-adjust-api.onrender.com/api
// In development the Vite proxy rewrites /api → http://localhost:8000/api
const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api'

const client = axios.create({ baseURL })

// Attach X-Session-ID header to every request for interaction logging
client.interceptors.request.use(config => {
  const sessionId = useSessionStore.getState().sessionId
  if (sessionId) config.headers['X-Session-ID'] = sessionId
  return config
})

export default client
