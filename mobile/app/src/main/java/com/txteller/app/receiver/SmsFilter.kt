package com.txteller.app.receiver

data class FilterResult(
    val isValid: Boolean,
    val reason: String
)

object SmsFilter {

    /**
     * Local Whitelist Filter:
     * Guarantees that only valid financial transactions from Bank Shahr are processed,
     * while OTPs (رمز پویا), promo messages, and personal SMS are immediately dropped.
     */
    fun shouldProcessSms(sender: String, body: String): FilterResult {
        // 1. Check Bank Identifier
        val isBankShahr = sender.contains("Bank Shahr", ignoreCase = true) ||
                body.contains("*بانک شهر*") ||
                body.contains("بانک شهر")

        if (!isBankShahr) {
            return FilterResult(false, "Rejected: Not from Bank Shahr")
        }

        // 2. Strict Negative Check: Drop OTP / Dynamic Password / Login Alerts
        val isOtpOrSecurity = body.contains("رمز:") ||
                body.contains("رمز پویا") ||
                body.contains("زمان اعتبار رمز") ||
                body.contains("کد تایید") ||
                body.contains("ورود به همراه شهر")

        if (isOtpOrSecurity) {
            return FilterResult(false, "Dropped: OTP / Security / Dynamic password detected")
        }

        // 3. Golden Whitelist Rule: Must contain both Amount and Balance labels
        val hasAmount = body.contains("مبلغ:") || body.contains("مبلغ :")
        val hasBalance = body.contains("موجودی:") || body.contains("موجودی :") ||
                body.contains("موجودي:") || body.contains("موجودي :")

        if (!hasAmount || !hasBalance) {
            return FilterResult(false, "Dropped: Missing required financial amount/balance fields")
        }

        return FilterResult(true, "Accepted Bank Shahr Transaction SMS")
    }
}
