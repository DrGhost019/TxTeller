package com.txteller.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = EmeraldLight,
    onPrimary = EmeraldSurfaceDark,
    primaryContainer = EmeraldCardDark,
    onPrimaryContainer = EmeraldLight,
    secondary = GoldAccent,
    background = EmeraldSurfaceDark,
    onBackground = SlateTextPrimaryDark,
    surface = EmeraldCardDark,
    onSurface = SlateTextPrimaryDark,
    error = ErrorRed
)

private val LightColorScheme = lightColorScheme(
    primary = EmeraldPrimary,
    onPrimary = EmeraldSurfaceLight,
    primaryContainer = EmeraldLight,
    onPrimaryContainer = EmeraldSurfaceLight,
    secondary = GoldAccent,
    background = EmeraldSurfaceLight,
    onBackground = SlateTextPrimaryLight,
    surface = EmeraldSurfaceLight,
    onSurface = SlateTextPrimaryLight,
    error = ErrorRed
)

@Composable
fun TxTellerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
