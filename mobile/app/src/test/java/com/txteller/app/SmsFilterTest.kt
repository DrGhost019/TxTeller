package com.txteller.app

import com.txteller.app.receiver.SmsFilter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsFilterTest {

    @Test
    fun testValidTransferWithdrawal() {
        val body = """
            *بانک شهر*
            انتقال وجه کارتي
            برداشت از:ACCOUNT_NUMBER
            مبلغ:2,511,000ريال
            موجودي:513,185,551 ريال
            1405/08/23 08:29:08
        """.trimIndent()

        val result = SmsFilter.shouldProcessSms("Bank Shahr", body)
        assertTrue(result.isValid)
    }

    @Test
    fun testValidPurchase() {
        val body = """
            *بانک شهر*
            خريد با کارت
            برداشت از:ACCOUNT_NUMBER
            مبلغ:3,609,000ريال
            موجودي:509,576,551 ريال
            1405/08/23 17:18:05
        """.trimIndent()

        val result = SmsFilter.shouldProcessSms("Bank Shahr", body)
        assertTrue(result.isValid)
    }

    @Test
    fun testValidTransferDeposit() {
        val body = """
            *بانک شهر*
            انتقال وجه کارتي
            واريز به:ACCOUNT_NUMBER
            مبلغ:3,200,000ريال
            موجودي:536,371,151ريال
            1405/08/19 21:04:45
        """.trimIndent()

        val result = SmsFilter.shouldProcessSms("Bank Shahr", body)
        assertTrue(result.isValid)
    }

    @Test
    fun testValidAtmWithdrawal() {
        val body = """
            *بانک شهر*
            برداشت از کارت
            برداشت از:ACCOUNT_NUMBER
            مبلغ:2,010,000ريال
            موجودي:546,957,820 ريال
            1405/07/25 12:53:14
        """.trimIndent()

        val result = SmsFilter.shouldProcessSms("Bank Shahr", body)
        assertTrue(result.isValid)
    }

    @Test
    fun testRejectOtpDynamicPassword() {
        val otpBody = """
            *بانک شهر*
            انتقال به 585983*3277
            مبلغ: 2,500,000 ريال
            رمز: 529000
            زمان اعتبار رمز: 08:30:53
            تاريخ: 1405/08/23 08:28:53
        """.trimIndent()

        val result = SmsFilter.shouldProcessSms("Bank Shahr", otpBody)
        assertFalse("OTP SMS must be strictly rejected", result.isValid)
        assertTrue(result.reason.contains("OTP", ignoreCase = true))
    }

    @Test
    fun testRejectGeneralAnnouncement() {
        val promoBody = """
            بانک شهر
            مشتری گرامی به منظور بروزرسانی زیرساخت ها، سامانههای بانک شهر با اختلال مواجه خواهد بود.
        """.trimIndent()

        val result = SmsFilter.shouldProcessSms("Bank Shahr", promoBody)
        assertFalse("System announcement without amount/balance must be rejected", result.isValid)
    }

    @Test
    fun testRejectLoginAlert() {
        val loginBody = """
            *بانک شهر*
            ورود به همراه شهر
            تاريخ : 1405/8/30
            ساعت : 13:48:59
        """.trimIndent()

        val result = SmsFilter.shouldProcessSms("Bank Shahr", loginBody)
        assertFalse("Login alert must be rejected", result.isValid)
    }

    @Test
    fun testRejectNonBankSms() {
        val personalBody = "سلام فردا ساعت ۵ جلسه داریم"
        val result = SmsFilter.shouldProcessSms("+989123456789", personalBody)
        assertFalse("Personal SMS must be rejected", result.isValid)
    }
}
