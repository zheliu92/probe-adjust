import client from './client'

export async function logEvent(event: string, payload: Record<string, unknown> = {}): Promise<void> {
  try {
    await client.post('/log', { event, payload })
  } catch {
    // Logging must never throw — silent failure
  }
}
