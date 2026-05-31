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
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.OffsetDateTime
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
                Toast.makeText(this@MainActivity, "Please grant permissions in Health Connect", Toast.LENGTH_LONG).show()
            }
        }
    }

    private suspend fun readAndSyncData(client: HealthConnectClient, endpoint: String, token: String) {
        statusText.text = "Status: Reading data..."
        
        try {
            val start = Instant.now().minus(1, ChronoUnit.DAYS)
            val end = Instant.now()

            val stepsResponse = client.readRecords(
                ReadRecordsRequest(
                    recordType = StepsRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(start, end)
                )
            )

            val totalSteps = stepsResponse.records.sumOf { it.count }
            statusText.text = "Status: Found $totalSteps steps. Syncing..."

            Thread {
                val result = runCatching { postSync(endpoint, token, totalSteps) }
                    .fold(
                        onSuccess = { it },
                        onFailure = { "ERROR: ${it.message ?: it.javaClass.simpleName}" }
                    )

                runOnUiThread {
                    statusText.text = result
                    syncButton.isEnabled = true
                }
            }.start()
            
        } catch (e: Exception) {
            statusText.text = "Status: Sync failed - ${e.message}"
        }
    }

    private fun postSync(endpoint: String, token: String, steps: Long): String {
        val today = LocalDate.now().toString()
        val payload = JSONObject()
            .put("deviceIdHash", "android-health-connect-sync")
            .put("dateRange", JSONObject().put("start", today).put("end", today))
            .put("dailySummaries", JSONArray().put(
                JSONObject()
                    .put("date", today)
                    .put("timezone", "Australia/Sydney")
                    .put("steps", steps)
                    .put("source_confidence", 1.0)
                    .put("sources", JSONObject().put("health_connect", true))
            ))
            .put("syncStartedAt", OffsetDateTime.now().toString())
            .put("appVersion", "HealthLensSync/0.3.0")

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

        return "HTTP $status\n$body"
    }
}
