package com.txteller.app.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface TxTellerApiService {

    @POST("api/messages")
    suspend fun postMessage(@Body request: SendMessageRequest): Response<SendMessageResponse>

    @GET("api/stats")
    suspend fun getStats(): Response<StatsResponse>
}
