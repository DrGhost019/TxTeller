package com.txteller.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface SmsDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(sms: SmsEntity): Long

    @Update
    suspend fun update(sms: SmsEntity)

    @Query("SELECT * FROM sms_queue WHERE status = 'PENDING' ORDER BY receivedAt ASC")
    suspend fun getPendingMessages(): List<SmsEntity>

    @Query("SELECT * FROM sms_queue ORDER BY receivedAt DESC LIMIT :limit")
    fun getRecentMessages(limit: Int = 50): Flow<List<SmsEntity>>

    @Query("SELECT COUNT(*) FROM sms_queue WHERE status = 'SYNCED'")
    fun getSyncedCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM sms_queue WHERE status = 'PENDING'")
    fun getPendingCount(): Flow<Int>

    @Query("DELETE FROM sms_queue WHERE status = 'SYNCED' AND receivedAt < :beforeTimestamp")
    suspend fun deleteOldSynced(beforeTimestamp: Long)
}
