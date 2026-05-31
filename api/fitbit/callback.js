import fetch from 'node-fetch'
import supabaseAdmin from '../lib/supabaseServer.js'

export default async function handler(req, res) {
  const { FITBIT_CLIENT_ID, FITBIT_CLIENT_SECRET, BASE_URL } = process.env
  const { code } = req.query || req.body || {}
  if (!code) {
    res.status(400).send('Missing code')
    return
  }
  if (!FITBIT_CLIENT_ID || !FITBIT_CLIENT_SECRET || !BASE_URL) {
    res.status(500).send('Missing environment variables')
    return
  }

  const tokenUrl = 'https://api.fitbit.com/oauth2/token'
  const redirectUri = `${BASE_URL}/api/fitbit/callback`

  const params = new URLSearchParams()
  params.append('client_id', FITBIT_CLIENT_ID)
  params.append('grant_type', 'authorization_code')
  params.append('redirect_uri', redirectUri)
  params.append('code', code)

  const auth = Buffer.from(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`).toString('base64')

  try {
    const r = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    })
    const data = await r.json()
    // Persist tokens into Supabase oauth_tokens table (server-side)
    try {
      const user_id = process.env.DEFAULT_USER_ID || 'local-user'
      const accountId = data.user_id || null
      const insertRow = {
        user_id,
        provider: 'fitbit',
        account_id: accountId,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null,
        scope: data.scope || null,
        raw_response: data
      }
      const { error: upsertErr } = await supabaseAdmin.from('oauth_tokens').upsert(insertRow, { onConflict: ['provider', 'account_id', 'user_id'] })
      if (upsertErr) console.warn('Failed to persist Fitbit token:', upsertErr.message)
    } catch (e) {
      console.warn('Supabase persist error', e.message)
    }

    res.status(200).json({ message: 'Fitbit token exchange successful (tokens persisted server-side if Supabase configured)', token: data })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
