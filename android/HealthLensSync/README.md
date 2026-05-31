# HealthLensSync Android Scaffold

This is a minimal Android Kotlin scaffold for the future HealthLens Android Health Connect sync app.

## What it includes

- Minimal Android Studio / Gradle app structure
- Kotlin `MainActivity` with a manual `Sync now` test sender
- Health Connect permission list and planned metrics
- Default sync endpoint configured as:
  `https://health-lens-rust.vercel.app/api/sync/health-connect`

## Install & build

### Prerequisites

- Android Studio Bumblebee or later
- Java 17+ installed
- Android SDK with API level 34

### Open in Android Studio

1. Open Android Studio.
2. Choose **Open** and select the `android/HealthLensSync` folder.
3. Sync Gradle and run the app on an emulator or device.

### Command-line build

If you have Gradle installed:

```bash
cd android/HealthLensSync
gradle clean assembleDebug
```

## Health Connect permissions

The Android app will need the following permissions when Health Connect is integrated:

- `android.permission.ACTIVITY_RECOGNITION`
- `android.permission.BODY_SENSORS`
- `android.permission.BLUETOOTH_SCAN` (optional future device sync)
- `android.permission.ACCESS_FINE_LOCATION` (for distance and activity matching)

Health Connect data access is handled through the platform APIs, not direct storage permissions.

## Planned data types

The app is designed to eventually sync these metrics:

- steps
- sleep sessions
- sleep stages
- HRV / RMSSD
- resting heart rate
- heart rate
- respiratory rate
- weight
- exercise sessions
- distance
- calories

## Sample payload builder

The sync endpoint expects a JSON payload like:

```json
{
  "deviceIdHash": "test-device-sync",
  "dateRange": { "start": "2026-05-31", "end": "2026-05-31" },
  "dailySummaries": [
    {
      "date": "2026-05-31",
      "timezone": "UTC",
      "steps": 8200,
      "calories_total": 2130,
      "resting_hr": 58,
      "hrv_rmssd": 42,
      "respiratory_rate": 15.4,
      "weight_kg": 77.2,
      "sleep_minutes": 430,
      "exercise_minutes": 38,
      "distance_m": 6200,
      "active_minutes": 65,
      "source_confidence": 0.92,
      "sources": { "android": true }
    }
  ],
  "syncStartedAt": "2026-05-31T12:00:00Z",
  "appVersion": "HealthLensSync/0.1.0"
}
```

## Manual sync test sender

The current app can send one fake Android-style daily summary payload to the HealthLens sync endpoint.

It requires the sync token to be pasted on-device. Do not commit the token to this repo.

This is still not real Health Connect data. It exists to prove:

- Android app -> Vercel endpoint
- bearer auth
- Supabase insert/idempotency
- dashboard update

The next Android step is replacing the fake payload builder with Health Connect aggregate reads.

## Default endpoint

The app is wired to send sync traffic to:

`https://health-lens-rust.vercel.app/api/sync/health-connect`
