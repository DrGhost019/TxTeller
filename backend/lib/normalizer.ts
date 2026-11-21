/**
 * Normalizes Persian and Arabic text strings:
 * - Converts Arabic Yeh (ي) and Kaf (ك) to Persian Yeh (ی) and Keheh (ک)
 * - Converts Persian (۰-۹) and Arabic (٠-٩) digits to standard Latin ASCII (0-9)
 * - Cleans up multiple spaces and standardizes line breaks
 */
export function normalizeBankText(input: string): string {
  if (!input) return '';

  let normalized = input;

  // 1. Standardize line breaks
  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Arabic characters to Persian
  normalized = normalized
    .replace(/\u064A/g, 'ی') // Arabic Yeh (ي) -> Persian Yeh (ی)
    .replace(/\u0649/g, 'ی') // Alef Maksura (ى) -> Persian Yeh (ی)
    .replace(/\u0643/g, 'ک'); // Arabic Kaf (ك) -> Persian Keheh (ک)

  // 3. Persian / Arabic digits to standard ASCII digits
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  for (let i = 0; i < 10; i++) {
    normalized = normalized.replaceAll(persianDigits[i], String(i));
    normalized = normalized.replaceAll(arabicDigits[i], String(i));
  }

  // 4. Persian/Arabic comma (،) to ASCII comma (,) and remove Tatweel (ـ)
  normalized = normalized
    .replace(/\u060C/g, ',') // Arabic comma (،) -> ,
    .replace(/\u0640/g, ''); // Tatweel (ـ) -> remove

  // 5. Clean extra spaces around colons (e.g. "مبلغ :" -> "مبلغ:")
  normalized = normalized.replace(/\s*:\s*/g, ':');

  return normalized.trim();
}
