package com.healthlens.sync

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit

class MainActivity : AppCompatActivity() {

    private lateinit var endpointInput: EditText
    private lateinit var tokenInput: EditText
    private lateinit var syncButton: Button
    private lateinit var statusText: TextView
    
    private val defaultEndpoint = "https://health-lens-rust.vercel.app/api/sync/health-connect"
    
    private val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class)
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        endpointInput = findViewById(R.id.endpointInput)
        tokenInput = findViewById(R.id.tokenInput)
        syncButton = findViewById(R.id.syncButton)
        statusText = findViewById(R.id.statusText)

        endpointInput.setText(defaultEndpoint)

        val healthConnectClient = HealthConnectClient.getOrCreate(this)

        syncButton.setOnClickListener {
            val endpoint = endpointInput.text.toString().trim()
            val token = tokenInput.text.toString().trim()

            if (endpoint.isBlank()) {
                statusText.text = "Status: Endpoint is required."
                return@setOnClickListener
            }
            if (token.isBlank()) {
                statusText.text = "Status: Sync token is required."
                return@setOnClickListener
            }

            syncButton.isEnabled = false
            checkPermissionsAndRun(healthConnectClient, endpoint, token)
        }
    }

    private fun checkPermissionsAndRun(client: HealthConnectClient, endpoint: String, token: String) {
        lifecycleScope.launch {
            val granted = client.permissionController.getGrantedPermissions()
            if (granted.containsAll(permissions)) {
                readAndSyncData(client, endpoint, token)
            } else {
                statusText.text = "Status: Permissions required"
                syncButton.isEnabled = true
                Toast.makeText(this@MainActivity, "Please grant permissions in Health Connect", Toast.LENGTH_LONG).show()
            }
        }
    }

    private suspend fun readAndSyncData(client: HealthConnectClient, endpoint: String, token: String) {
        statusText.text = "Status: Reading data..."
        
        try {
            val start = Instant.now().minus(1, ChronoUnit.DAYS)
            val end = Instant.now()
            val filter = TimeRangeFilter.between(start, end)

            // Read Steps
            val stepsResponse = client.readRecords(ReadRecordsRequest(StepsRecord::class, filter))
            val totalSteps = stepsResponse.records.sumOf { it.count }

            // Read Sleep
            val sleepResponse = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, filter))
            val sleepRecords = JSONArray()
            sleepResponse.records.forEach { record ->
                val duration = ChronoUnit.MINUTES.between(record.startTime, record.endTime)
                sleepRecords.put(JSONObject().apply {
                    put("start_time", record.startTime.toString())
                    put("end_time", record.endTime.toString())
                    put("duration_minutes", duration)
                    put("source_id", "health_connect")
                })
            }

            // Read Weight
            val weightResponse = client.readRecords(ReadRecordsRequest(WeightRecord::class, filter))
            val bodyRecords = JSONArray()
            weightResponse.records.forEach { record ->
                bodyRecords.put(JSONObject().apply {
                    put("timestamp", record.time.toString())
                    put("metric_type", "weight_kg")
                    put("value", record.weight.inKilograms)
                    put("source_id", "health_connect")
                })
            }

            // Read Heart Rate
            val heartResponse = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, filter))
            val heartRecords = JSONArray()
            heartResponse.records.forEach { record ->
                record.samples.forEach { sample ->
                    heartRecords.put(JSONObject().apply {
                        put("timestamp", sample.time.toString())
                        put("metric_type", "heart_rate")
                        put("value", sample.beatsPerMinute)
                        put("source_id", "health_connect")
                    })
                }
            }

            statusText.text = "Status: Data collected. Sending to HealthLens..."

            val today = LocalDate.now(ZoneId.systemDefault()).toString()
            val payload = JSONObject().apply {
                put("deviceIdHash", "android-health-connect-sync")
                put("dateRange", JSONObject().apply {
                    put("start", today)
                    put("end", today)
                })
                put("dailySummaries", JSONArray().put(JSONObject().apply {
                    put("date", today)
                    put("timezone", ZoneId.systemDefault().id)
                    put("steps", totalSteps)
                    put("sleep_minutes", if (sleepResponse.records.isNotEmpty()) ChronoUnit.MINUTES.between(sleepResponse.records.first().startTime, sleepResponse.records.last().endTime) else 0)
                    put("source_confidence", 1.0)
                    put("sources", JSONObject().put("health_connect", true))
                }))
                put("sleepRecords", sleepRecords)
                put("heartRecords", heartRecords)
                put("bodyRecords", bodyRecords)
                put("syncStartedAt", OffsetDateTime.now().toString())
                put("appVersion", "HealthLensSync/0.4.0")
            }

            val result = withContext(Dispatchers.IO) {
                performPost(endpoint, token, payload)
            }

            statusText.text = "Status: $result"
            syncButton.isEnabled = true
            
        } catch (e: Exception) {
            statusText.text = "Status: Sync failed - ${e.message}"
            syncButton.isEnabled = true
        }
    }

    private fun performPost(endpoint: String, token: String, payload: JSONObject): String {
        return try {
            val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15000
                readTimeout = 20000
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
            }

            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { writer ->
                writer.write(payload.toString())
            }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val body = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            connection.disconnect()

            if (status in 200..299) {
                "Last sync successful (${Instant.now()})\nHTTP $status"
            } else {
                "Sync failed: HTTP $status\n$body"
            }
        } catch (e: Exception) {
            "Network error: ${e.message}"
        }
    }
}
