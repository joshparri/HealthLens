Yes — **Strava automatic sync is possible**, and it’s probably easier than Android Health Connect technically. But it only syncs **Strava activity data**, not your whole health picture.

So it can automatically bring in:

* runs/rides/walks/workouts recorded in Strava
* activity name/type/sport type
* distance
* moving time / elapsed time
* elevation
* activity ID
* maybe streams like heart rate, distance, cadence, velocity, depending on what Strava has for that activity

It will **not** replace Health Connect for:

* sleep
* HRV/RMSSD baseline
* resting HR
* respiratory rate
* weight
* daily steps outside recorded Strava activities
* pathology/lab data

## How Strava automatic sync would work

The right setup is:

```text
Strava OAuth connection
→ store refresh token in Supabase
→ Strava webhook tells HealthLens “new activity created”
→ HealthLens fetches that activity from Strava
→ save it into exercise_sessions / heart_metrics
→ dashboard updates
```

Strava supports webhooks, and their docs say webhook events are pushed shortly after Strava events occur, avoiding constant polling. Events include activity created, deleted, and certain updates. ([Strava Developers][1])

For backfilling old activities, HealthLens can call Strava’s `/athlete/activities` endpoint. That endpoint returns activities for the authorised athlete, supports `before`, `after`, `page`, and `per_page`, and requires `activity:read`; “Only Me” activities need `activity:read_all`. ([Strava Developers][2])

For deeper activity data, Strava also has activity streams at `/activities/{id}/streams`, including stream types such as distance and other activity time-series data, with `activity:read` or `activity:read_all` for private activities. ([Strava Developers][2])

## Important limitation

Strava is great for **exercise sessions**, not daily health. For your HealthLens system I’d treat Strava as:

```text
exercise source
```

not:

```text
main health source
```

Your main automatic source should still be Health Connect later. Strava can be an excellent earlier win though, because OAuth + webhook + activity fetch is a known web-app pattern.

## One good reason to build Strava now

Strava webhooks mean you can get a nice “automatic sync” feeling quickly:

> I record a ride/walk/run → Strava receives it → HealthLens updates.

Strava’s docs also recommend using webhooks rather than polling, and their rate-limit page specifically lists “Activity polling is causing you to hit your daily rate limits” with the solution “Implement webhooks.” ([Strava Developers][3])

## Watch the rate limits

Default Strava rate limits are **200 requests per 15 minutes / 2,000 per day overall**, and **100 requests per 15 minutes / 1,000 per day** for non-upload endpoints. Newly created apps start in “Single Player Mode,” meaning athlete capacity of 1, which is fine for your personal app. ([Strava Developers][3])

That means: don’t fetch every activity stream every minute. Use webhook events, fetch only new/changed activities, and throttle backfills.

## What needs building

HealthLens likely already has some Fitbit/Withings OAuth scaffolding, but for Strava you’d need:

1. **Strava app registration**

   * Get client ID and client secret from Strava API settings.
   * Set callback domain to your Vercel domain.

2. **OAuth start endpoint**

   * `/api/strava/start`
   * redirects you to Strava authorisation.

3. **OAuth callback endpoint**

   * `/api/strava/callback`
   * exchanges `code` for access token + refresh token.
   * stores refresh token in Supabase.

Strava’s auth flow returns an authorisation code, which must be exchanged for a refresh token and short-lived access token. ([Strava Developers][4]) Refresh tokens can change when refreshed, so the app must update the stored refresh token after refresh. ([Strava Developers][4])

4. **Webhook endpoint**

   * `/api/strava/webhook`
   * handles GET verification by echoing `hub.challenge`.
   * handles POST events for activity create/update/delete.

5. **Activity fetcher**

   * refresh access token if needed.
   * fetch activity details.
   * optionally fetch streams.
   * map to `exercise_sessions`.
   * map heart-rate stream to `heart_metrics` if available.

6. **Backfill job**

   * fetch activities from last 90 days or all history.
   * write into Supabase.
   * idempotent by Strava activity ID.

7. **Dashboard source labels**

   * show `Strava` as source.
   * avoid treating Strava activities as total daily movement.

## Tables you may need

You already have `exercise_sessions` and `heart_metrics`, which is good.

I’d add/ensure:

```text
oauth_tokens
strava_activities
sync_events
```

`strava_activities` should store Strava-specific fields so you don’t lose provenance.

## Prompt for Copilot/Trae

Build automatic Strava sync for HealthLens as an exercise-source connector.

Repo:
[https://github.com/joshualparris/HealthLens](https://github.com/joshualparris/HealthLens)

Live app:
[https://health-lens-rust.vercel.app/](https://health-lens-rust.vercel.app/)

Goal:
Add Strava automatic sync so Strava activities are pulled into HealthLens and stored in Supabase as exercise sessions and optional heart metrics.

Important:

* Treat Strava as an exercise/activity source only.
* Do not treat Strava as the main health source.
* Do not use Strava to infer sleep, HRV baseline, resting HR, respiratory rate, weight, or daily steps outside recorded activities.
* Do not commit Strava client secrets, API tokens, refresh tokens, health files, or personal data.
* Use server-side Vercel env vars for secrets.
* Store provenance for every synced activity.
* Make all sync idempotent by Strava activity ID.
* Use Australia/Sydney for display timezone unless Strava data says otherwise.

## Required env vars

Add to `.env.example`:

```env
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_VERIFY_TOKEN=
STRAVA_WEBHOOK_CALLBACK_URL=https://health-lens-rust.vercel.app/api/strava/webhook
STRAVA_REDIRECT_URI=https://health-lens-rust.vercel.app/api/strava/callback
```

Do not commit real values.

## Supabase schema

Inspect existing tables first.

If not already present, add migration for:

### `strava_activities`

Fields:

* id uuid primary key
* user_id uuid
* strava_activity_id text unique not null
* name text
* sport_type text
* type text
* start_date timestamptz
* start_date_local timestamptz
* timezone text
* distance_m numeric
* moving_time_seconds integer
* elapsed_time_seconds integer
* total_elevation_gain numeric
* average_speed numeric
* max_speed numeric
* average_heartrate numeric
* max_heartrate numeric
* calories numeric
* suffer_score numeric
* private boolean
* trainer boolean
* commute boolean
* gear_id text
* raw_json jsonb
* synced_at timestamptz default now()
* created_at timestamptz default now()
* updated_at timestamptz default now()

### `strava_webhook_events`

Fields:

* id uuid primary key
* object_type text
* object_id text
* aspect_type text
* owner_id text
* subscription_id text
* event_time timestamptz
* updates_json jsonb
* processed boolean default false
* error text
* created_at timestamptz default now()

Also ensure `exercise_sessions` can store:

* source_id
* import_id
* external_id or raw_json with Strava ID

If no external ID exists, add `external_id text`.

## OAuth endpoints

Create:

### `api/strava/start.js`

* Builds Strava authorisation URL.
* Uses scopes:

  * `read`
  * `activity:read`
  * optionally `activity:read_all` if Josh wants private activities.
* Redirects to Strava.

### `api/strava/callback.js`

* Reads `code` and `scope`.
* Exchanges code for access token and refresh token.
* Stores tokens server-side in Supabase `oauth_tokens`.
* Store accepted scopes.
* Never return token values to the browser.
* Redirect to HealthLens with success/failure state.

Strava access tokens are short-lived and require refresh tokens. Refresh tokens may change, so update stored tokens after refresh.

## Token helper

Create:

`api/lib/stravaClient.js`

Functions:

* `refreshStravaToken(userId)`
* `getValidStravaAccessToken(userId)`
* `fetchStravaActivity(activityId, accessToken)`
* `fetchStravaActivities({ after, before, page, perPage })`
* `fetchStravaActivityStreams(activityId, keys, accessToken)`
* `upsertStravaActivityToSupabase(activity, streams?)`

Map Strava activity to:

* `strava_activities`
* `exercise_sessions`
* `heart_metrics` if heart-rate stream or average/max HR exists

## Webhook endpoint

Create:

### `api/strava/webhook.js`

GET:

* Verify Strava callback.
* If `hub.verify_token` matches `STRAVA_VERIFY_TOKEN`, return:
  `{ "hub.challenge": "[challenge]" }`
* Must respond fast.

POST:

* Receive Strava webhook event.
* Store event in `strava_webhook_events`.
* Immediately return 200 quickly.
* For `object_type = activity` and `aspect_type = create/update`, fetch latest activity details asynchronously or in a safe serverless-compatible way.
* For `aspect_type = delete`, mark matching activity/exercise session deleted or remove it.
* Respect privacy changes.

Strava webhook events include object type, object ID, aspect type, owner ID, updates, subscription ID and event time. Use those fields.

## Webhook subscription setup

Add script:

`scripts/register-strava-webhook.mjs`

It should:

* read `STRAVA_CLIENT_ID`
* read `STRAVA_CLIENT_SECRET`
* read `STRAVA_VERIFY_TOKEN`
* read `STRAVA_WEBHOOK_CALLBACK_URL`
* create a Strava webhook subscription
* print result without secrets

Also add:

`scripts/list-strava-webhook.mjs`

and optionally:

`scripts/delete-strava-webhook.mjs`

Strava allows one webhook subscription per application, so handle the case where one already exists.

## Backfill script

Add:

`scripts/backfill-strava-activities.mjs`

It should:

* require a connected Strava account/token
* fetch `/athlete/activities`
* support `--after` date
* support `--days 90`
* paginate safely
* respect rate limits
* upsert activities by Strava activity ID
* optionally fetch activity streams only when useful
* report count inserted/updated/skipped

Do not fetch every stream by default during big backfill.

## Dashboard/UI

Add Strava source panel:

* connection status
* last Strava sync
* number of Strava activities
* latest Strava activity date
* “Connect Strava” button
* “Backfill last 90 days” button
* “Disconnect Strava” button if practical

Add dashboard cards/charts:

* Strava activities per week
* Strava distance per week
* Strava moving time per week
* Strava activity types
* average HR/max HR if available

Label clearly:

“Strava activities only — not total daily movement.”

## DataPack integration

When building HealthLens DataPack, include Strava as:

* exercise source
* not all-day activity source
* include date range
* number of activities
* total distance
* total moving time
* activity type breakdown
* HR availability
* privacy/source warnings

AI prompt must not use Strava to make claims about sleep, HRV baseline, resting HR, or all-day steps.

## Tests

Add tests for:

* webhook GET validation returns challenge
* webhook rejects wrong verify token
* webhook POST stores event
* Strava activity maps to `exercise_sessions`
* duplicate activity upsert does not duplicate rows
* deleted activity is marked/deleted correctly
* DataPack labels Strava as exercise-only source

Run:

```bash
npm run test
npm run build
```

## Final report

Report:

1. Commit hash.
2. Files changed.
3. New env vars required.
4. Supabase migration added.
5. OAuth endpoints added.
6. Webhook endpoint added.
7. Webhook registration script added.
8. Backfill script added.
9. Dashboard/UI changes.
10. Tests and build result.
11. What Josh still needs to do in Strava API settings, if anything.

## My take

For HealthLens, Strava automatic sync is a **good side-quest**, not the main quest.

I’d build it if you want your e-bike rides, walks, workouts and runs pulled in automatically. But for the deep health dashboard you’ve been imagining, Health Connect still matters more because that’s where sleep, HRV, RHR, respiratory and weight data should come from.

[1]: https://developers.strava.com/docs/webhooks/ "Strava Developers"
[2]: https://developers.strava.com/docs/reference/ "Strava Developers"
[3]: https://developers.strava.com/docs/rate-limits/ "Strava Developers"
[4]: https://developers.strava.com/docs/authentication/ "Strava Developers"
