package com.txteller.app.data.remote

import android.content.Context
import com.txteller.app.data.preferences.PreferencesManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {

    @Volatile
    private var currentBaseUrl: String? = null
    @Volatile
    private var apiService: TxTellerApiService? = null

    fun getApiService(context: Context): TxTellerApiService {
        val prefs = PreferencesManager(context)
        var url = prefs.getBaseUrl().trim()
        if (!url.endsWith("/")) {
            url += "/"
        }

        if (apiService == null || currentBaseUrl != url) {
            synchronized(this) {
                if (apiService == null || currentBaseUrl != url) {
                    currentBaseUrl = url

                    val authInterceptor = Interceptor { chain ->
                        val original = chain.request()
                        val apiKey = prefs.getApiKey().trim()

                        val requestBuilder = original.newBuilder()
                            .header("Content-Type", "application/json")
                            .header("Accept", "application/json")

                        if (apiKey.isNotEmpty()) {
                            requestBuilder.header("x-api-key", apiKey)
                        }

                        chain.proceed(requestBuilder.build())
                    }

                    val logging = HttpLoggingInterceptor().apply {
                        level = HttpLoggingInterceptor.Level.BODY
                    }

                    val okHttpClient = OkHttpClient.Builder()
                        .addInterceptor(authInterceptor)
                        .addInterceptor(logging)
                        .connectTimeout(20, TimeUnit.SECONDS)
                        .readTimeout(20, TimeUnit.SECONDS)
                        .build()

                    val retrofit = Retrofit.Builder()
                        .baseUrl(url)
                        .client(okHttpClient)
                        .addConverterFactory(GsonConverterFactory.create())
                        .build()

                    apiService = retrofit.create(TxTellerApiService::class.java)
                }
            }
        }
        return apiService!!
    }

    fun reset() {
        synchronized(this) {
            apiService = null
            currentBaseUrl = null
        }
    }
}
