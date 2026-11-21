import { ParsedTransaction } from './parser';

export interface CategoryButton {
  id: string;
  name: string;
  persianName: string;
  icon: string;
}

/**
 * Format amounts nicely in Toman and Rial with comma separators
 */
export function formatCurrency(amountRial: bigint): { rial: string; toman: string } {
  const rialStr = amountRial.toLocaleString('en-US');
  const tomanAmount = amountRial / 10n;
  const tomanStr = tomanAmount.toLocaleString('en-US');
  return { rial: rialStr, toman: tomanStr };
}

/**
 * Sends a rich transaction alert to the owner's Telegram with 8 inline category buttons
 */
export async function sendTransactionTelegramAlert(
  transactionId: string,
  tx: ParsedTransaction,
  categories: CategoryButton[]
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('[Telegram Alert Skipped]: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in env.');
    return false;
  }

  const { rial, toman } = formatCurrency(tx.amount);
  const balanceFmt = formatCurrency(tx.balance);

  const directionSymbol =
    tx.txType === 'TRANSFER_IN' ? '🟢 واریز' : '🔴 برداشت';

  const messageText = `
🔔 *تراکنش جدید بانک شهر*
${directionSymbol} | *${tx.title}*

💰 *مبلغ:* ${toman} تومان (${rial} ریال)
🏦 *مانده حساب:* ${balanceFmt.toman} تومان
🕒 *زمان:* ${tx.shamsiDate} ساعت ${tx.shamsiTime}
💳 *حساب:* \`${tx.accountCard}\`

👇 *لطفاً دسته‌بندی این هزینه را مشخص کنید:*
`.trim();

  // Build 2 columns of inline keyboard buttons
  const inlineKeyboard: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < categories.length; i += 2) {
    const row: Array<{ text: string; callback_data: string }> = [];
    const cat1 = categories[i];
    row.push({
      text: `${cat1.icon} ${cat1.persianName}`,
      callback_data: `cat:${transactionId}:${cat1.id}`,
    });

    if (i + 1 < categories.length) {
      const cat2 = categories[i + 1];
      row.push({
        text: `${cat2.icon} ${cat2.persianName}`,
        callback_data: `cat:${transactionId}:${cat2.id}`,
      });
    }
    inlineKeyboard.push(row);
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      }),
    });

    const data = await res.json();
    return data.ok === true;
  } catch (err) {
    console.error('Failed to send Telegram alert:', err);
    return false;
  }
}
