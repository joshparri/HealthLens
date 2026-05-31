import { fetchDailySummary } from '../lib/fitbitClient.js'
import supabaseAdmin from '../lib/supabaseServer.js'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).send('ok')
    return
  }

  const payload = req.body
  console.log('Fitbit webhook payload', payload)

  try {
    // Fitbit sends an array of notifications
    const notifications = Array.isArray(payload) ? payload : [payload]
    for (const note of notifications) {
      const ownerId = note.ownerId || note.userId || note.ownerId
      const collectionType = note.collectionType || note.collectionType
      // For daily activity updates, try to fetch summary for today
      const date = new Date().toISOString().slice(0,10)
      if (ownerId) {
        try {
          const summary = await fetchDailySummary(ownerId, date)
          // Build a minimal dailySummary row to insert
          const ds = {
            user_id: process.env.DEFAULT_USER_ID || 'local-user',
            date,
            timezone: 'Australia/Sydney',
            steps: summary.summary?.steps || null,
            calories_total: summary.summary?.caloriesOut || null,
            sources_json: { provider: 'fitbit', collectionType },
            created_at: new Date().toISOString()
          }
          await supabaseAdmin.from('daily_health_summary').insert(ds)
        } catch (e) {
          console.warn('Failed to fetch or store Fitbit summary for', ownerId, e.message)
        }
      }
    }
    res.status(204).end()
  } catch (e) {
    console.error('Webhook handler error', e.message)
    res.status(500).json({ error: e.message })
  }
}
