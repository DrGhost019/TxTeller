package com.txteller.app.data.remote

import com.google.gson.annotations.SerializedName

data class SendMessageRequest(
    @SerializedName("sender") val sender: String,
    @SerializedName("body") val body: String
)

data class SendMessageResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("transactionId") val transactionId: String?,
    @SerializedName("amount") val amount: String?,
    @SerializedName("balance") val balance: String?,
    @SerializedName("type") val type: String?,
    @SerializedName("duplicate") val duplicate: Boolean?,
    @SerializedName("error") val error: String?
)

data class StatsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: StatsData?
)

data class StatsData(
    @SerializedName("currentBalance") val currentBalance: String,
    @SerializedName("lastUpdatedDate") val lastUpdatedDate: String?,
    @SerializedName("monthlyStats") val monthlyStats: MonthlyStats?
)

data class MonthlyStats(
    @SerializedName("totalSpent") val totalSpent: String,
    @SerializedName("totalIncome") val totalIncome: String,
    @SerializedName("transactionCount") val transactionCount: Int
)
