package com.txteller.app.worker

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.txteller.app.data.local.AppDatabase
import com.txteller.app.data.local.SyncStatus
import com.txteller.app.data.preferences.PreferencesManager
import com.txteller.app.data.remote.RetrofitClient
import com.txteller.app.data.remote.SendMessageRequest
import java.util.concurrent.TimeUnit

class SmsSyncWorker(
    private val context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        Log.i(TAG, "Starting SMS Sync Worker...")

        val db = AppDatabase.getDatabase(context)
        val smsDao = db.smsDao()
        val prefs = PreferencesManager(context)

        val pendingMessages = smsDao.getPendingMessages()
        if (pendingMessages.isEmpty()) {
            Log.d(TAG, "No pending messages to sync.")
            return Result.success()
        }

        Log.d(TAG, "Found ${pendingMessages.size} pending message(s) to sync.")
        val apiService = RetrofitClient.getApiService(context)
        var hasFailures = false

        for (item in pendingMessages) {
            try {
                val response = apiService.postMessage(
                    SendMessageRequest(
                        sender = item.sender,
                        body = item.body
                    )
                )

                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    if (body.success || body.duplicate == true) {
                        Log.i(TAG, "SMS ${item.id} successfully synced (Duplicate: ${body.duplicate})")
                        smsDao.update(
                            item.copy(
                                status = SyncStatus.SYNCED,
                                lastError = null
                            )
                        )
                    } else {
                        Log.w(TAG, "Server rejected message ${item.id}: ${body.error}")
                        smsDao.update(
                            item.copy(
                                status = SyncStatus.FAILED,
                                lastError = body.error ?: "Server rejected message"
                            )
                        )
                    }
                } else {
                    val errorBody = response.errorBody()?.string() ?: response.message()
                    Log.e(TAG, "HTTP error syncing SMS ${item.id}: $errorBody")
                    smsDao.update(
                        item.copy(
                            retryCount = item.retryCount + 1,
                            lastError = "HTTP ${response.code()}: $errorBody"
                        )
                    )
                    hasFailures = true
                }
            } catch (e: Exception) {
                Log.e(TAG, "Network exception syncing SMS ${item.id}: ${e.message}")
                smsDao.update(
                    item.copy(
                        retryCount = item.retryCount + 1,
                        lastError = e.localizedMessage ?: "Network error"
                    )
                )
                hasFailures = true
            }
        }

        prefs.setLastSyncTime(System.currentTimeMillis())

        return if (hasFailures) {
            Log.w(TAG, "Sync had failures. Retrying with exponential backoff...")
            Result.retry()
        } else {
            Log.i(TAG, "All pending SMS successfully synced.")
            Result.success()
        }
    }

    companion object {
        private const val TAG = "TxTeller:SyncWorker"
        private const val UNIQUE_WORK_NAME = "txteller_one_time_sync"
        private const val PERIODIC_WORK_NAME = "txteller_periodic_sync"

        /**
         * Enqueues an immediate one-time sync task when network is connected
         */
        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = OneTimeWorkRequestBuilder<SmsSyncWorker>()
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    15,
                    TimeUnit.SECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }

        /**
         * Schedules a periodic backup sync (runs every 15 minutes) in case network was off
         */
        fun setupPeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val periodicRequest = PeriodicWorkRequestBuilder<SmsSyncWorker>(
                15, TimeUnit.MINUTES,
                5, TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                periodicRequest
            )
        }
    }
}
