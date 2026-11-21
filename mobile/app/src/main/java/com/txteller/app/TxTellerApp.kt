package com.txteller.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.work.Configuration
import androidx.work.WorkManager
import com.txteller.app.data.local.AppDatabase
import com.txteller.app.worker.SmsSyncWorker

class TxTellerApp : Application(), Configuration.Provider {

    val database: AppDatabase by lazy { AppDatabase.getDatabase(this) }

    override fun onCreate() {
        super.onCreate()
        instance = this

        createNotificationChannel()
        SmsSyncWorker.setupPeriodicSync(this)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "TxTeller Bank SMS Sync",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "اعلان وضعیت همگام‌سازی تراکنش‌های بانک شهر"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build()

    companion object {
        const val CHANNEL_ID = "txteller_sync_channel"
        lateinit var instance: TxTellerApp
            private set
    }
}
