import supabaseAdmin from './supabaseServer.js'
import fetch from 'node-fetch'

const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token'

async function refreshTokenRow(row) {
  const clientId = process.env.FITBIT_CLIENT_ID
  const clientSecret = process.env.FITBIT_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Missing Fitbit client credentials')

  const params = new URLSearchParams()
  params.append('grant_type', 'refresh_token')
  params.append('refresh_token', row.refresh_token)

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const r = await fetch(FITBIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })
  const data = await r.json()
  if (!data.access_token) throw new Error('Failed to refresh token')

  const expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null
  const update = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || row.refresh_token,
    expires_at: expiresAt,
    scope: data.scope || row.scope,
    raw_response: data
  }
  await supabaseAdmin.from('oauth_tokens').update(update).match({ id: row.id })
  return { ...row, ...update }
}

export async function getAccessTokenForAccount(accountId) {
  const { data, error } = await supabaseAdmin.from('oauth_tokens').select('*').eq('provider', 'fitbit').eq('account_id', accountId).limit(1).single()
  if (error) throw error
  let row = data
  if (!row) throw new Error('No token found for account')
  if (row.expires_at && new Date(row.expires_at) <= new Date()) {
    row = await refreshTokenRow(row)
  }
  return row.access_token
}

export async function fetchDailySummary(accountId, date) {
  const token = await getAccessTokenForAccount(accountId)
  const url = `https://api.fitbit.com/1/user/-/activities/date/${date}.json`
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`Fitbit API error: ${r.status}`)
  return r.json()
}
