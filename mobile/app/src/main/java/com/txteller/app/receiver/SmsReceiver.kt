package com.txteller.app.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import com.txteller.app.data.local.AppDatabase
import com.txteller.app.data.local.SmsEntity
import com.txteller.app.data.local.SyncStatus
import com.txteller.app.worker.SmsSyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        // Multi-part SMS reassembly
        val sender = messages[0].originatingAddress ?: "Unknown"
        val bodyBuilder = StringBuilder()
        for (sms in messages) {
            bodyBuilder.append(sms.messageBody)
        }
        val fullBody = bodyBuilder.toString()

        Log.d(TAG, "Incoming SMS from: $sender")

        // 1. Run strict local whitelist filter
        val filterResult = SmsFilter.shouldProcessSms(sender, fullBody)
        if (!filterResult.isValid) {
            Log.d(TAG, "SMS discarded: ${filterResult.reason}")
            return
        }

        Log.i(TAG, "Valid Bank Shahr SMS accepted. Enqueuing for sync...")

        // 2. Persist to Room SQLite queue and trigger background sync worker
        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val db = AppDatabase.getDatabase(context)
                val newSms = SmsEntity(
                    sender = sender,
                    body = fullBody,
                    status = SyncStatus.PENDING
                )
                val id = db.smsDao().insert(newSms)
                Log.d(TAG, "Saved SMS to offline queue with ID: $id")

                // 3. Immediately trigger WorkManager to push to server
                SmsSyncWorker.enqueue(context)
            } catch (e: Exception) {
                Log.error(TAG, "Error saving SMS to queue", e)
            } finally {
                pendingResult.finish()
            }
        }
    }

    companion object {
        private const val TAG = "TxTeller:SmsReceiver"
    }
}

private fun Log.error(tag: String, msg: String, tr: Throwable) {
    Log.e(tag, msg, tr)
}
