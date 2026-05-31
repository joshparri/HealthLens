package com.healthlens.sync

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private val defaultEndpoint = "https://health-lens-rust.vercel.app/api/sync/health-connect"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        findViewById<TextView>(R.id.endpointText).text = defaultEndpoint
        findViewById<Button>(R.id.syncButton).setOnClickListener {
            Toast.makeText(this, "Sync now placeholder — Health Connect integration pending.", Toast.LENGTH_LONG).show()
        }
    }
}
