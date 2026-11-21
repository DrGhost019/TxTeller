import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/lib/telegram';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(chatId: string | number, text: string, replyMarkup?: any) {
  if (!TELEGRAM_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }),
    });
  } catch (err) {
    console.error('Error sending telegram message:', err);
  }
}

async function answerTelegramCallback(callbackQueryId: string, text?: string) {
  if (!TELEGRAM_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
      }),
    });
  } catch (err) {
    console.error('Error answering callback:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();

    // 1. Handle Inline Button Clicks (Callback Query)
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = String(cq.message?.chat?.id || '');
      const callbackData: string = cq.data || '';

      // Security check: Only allow designated owner
      if (ALLOWED_CHAT_ID && chatId !== ALLOWED_CHAT_ID) {
        await answerTelegramCallback(cq.id, 'دسترسی غیرمجاز');
        return NextResponse.json({ ok: true });
      }

      // Handle Category Selection: "cat:<txId>:<catId>"
      if (callbackData.startsWith('cat:')) {
        const [, txId, catId] = callbackData.split(':');

        const category = await prisma.category.findUnique({ where: { id: catId } });
        if (category && txId) {
          await prisma.transaction.update({
            where: { id: txId },
            data: { categoryId: catId },
          });

          await answerTelegramCallback(cq.id, `دسته‌بندی ${category.persianName} ثبت شد`);

          // Follow-up: Ask for Merchant / Vendor name
          await sendTelegramMessage(
            chatId,
            `✅ دسته‌بندی روی *${category.icon} ${category.persianName}* تنظیم شد.\n\n🏬 *نام فروشگاه یا پذیرنده چیست؟*\n_(می‌توانید نام را تایپ کرده و بفرستید، یا دکمه رد کردن را بزنید)_`,
            {
              inline_keyboard: [
                [
                  {
                    text: '⏭ رد کردن (بدون نام)',
                    callback_data: `skip:${txId}`,
                  },
                ],
              ],
            }
          );
        }
        return NextResponse.json({ ok: true });
      }

      // Handle Skip Merchant: "skip:<txId>"
      if (callbackData.startsWith('skip:')) {
        await answerTelegramCallback(cq.id, 'رد شد');
        await sendTelegramMessage(chatId, '✨ تراکنش نهایی شد.');
        return NextResponse.json({ ok: true });
      }

      await answerTelegramCallback(cq.id);
      return NextResponse.json({ ok: true });
    }

    // 2. Handle Text Messages and Commands
    if (update.message && update.message.text) {
      const msg = update.message;
      const chatId = String(msg.chat.id);
      const text = msg.text.trim();

      // Security check
      if (ALLOWED_CHAT_ID && chatId !== ALLOWED_CHAT_ID) {
        return NextResponse.json({ ok: true });
      }

      // Command: /start
      if (text === '/start') {
        await sendTelegramMessage(
          chatId,
          `👋 *سلام به سامانه TxTeller خوش آمدید.*\n\nربات اختصاصی مدیریت تراکنش‌های بانک شهر فعال است.\n\nدستورات در دسترس:\n/balance — آخرین موجودی حساب\n/today — گزارش هزینه‌های امروز\n/month — گزارش ماهانه\n/transactions — لیست ۵ تراکنش اخیر`
        );
        return NextResponse.json({ ok: true });
      }

      // Command: /balance
      if (text === '/balance') {
        const latestTx = await prisma.transaction.findFirst({
          orderBy: { txTimestamp: 'desc' },
        });

        if (!latestTx) {
          await sendTelegramMessage(chatId, 'هنوز هیچ تراکنشی ثبت نشده است.');
        } else {
          const balance = formatCurrency(latestTx.balance);
          await sendTelegramMessage(
            chatId,
            `🏦 *آخرین موجودی گزارش‌شده بانک شهر:*\n\n💰 *${balance.toman} تومان*\n(${balance.rial} ریال)\n\n🕒 تاریخ آخرین تراکنش: ${latestTx.shamsiDate} ${latestTx.shamsiTime}`
          );
        }
        return NextResponse.json({ ok: true });
      }

      // Command: /today
      if (text === '/today') {
        const today = new Date();
        const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

        const todayTxs = await prisma.transaction.findMany({
          where: { txTimestamp: { gte: startOfDay } },
        });

        let spent = 0n;
        let income = 0n;
        for (const t of todayTxs) {
          if (t.txType === 'TRANSFER_IN') income += t.amount;
          else spent += t.amount;
        }

        const spentFmt = formatCurrency(spent);
        const incomeFmt = formatCurrency(income);

        await sendTelegramMessage(
          chatId,
          `📊 *خلاصه مالی امروز:*\n\n🔴 مجموع مخارج: *${spentFmt.toman} تومان*\n🟢 مجموع واریزی: *${incomeFmt.toman} تومان*\n🔢 تعداد تراکنش‌ها: ${todayTxs.length}`
        );
        return NextResponse.json({ ok: true });
      }

      // Command: /transactions
      if (text === '/transactions') {
        const recent = await prisma.transaction.findMany({
          take: 5,
          orderBy: { txTimestamp: 'desc' },
          include: { category: true },
        });

        if (recent.length === 0) {
          await sendTelegramMessage(chatId, 'هیچ تراکنشی یافت نشد.');
          return NextResponse.json({ ok: true });
        }

        let resp = '📋 *۵ تراکنش اخیر:*\n\n';
        for (const t of recent) {
          const amt = formatCurrency(t.amount);
          const icon = t.category?.icon || (t.txType === 'TRANSFER_IN' ? '🟢' : '🔴');
          const catName = t.category?.persianName || t.title;
          const merchantInfo = t.merchant ? ` (${t.merchant})` : '';
          resp += `${icon} *${amt.toman} تومان* — ${catName}${merchantInfo}\n🕒 ${t.shamsiDate} ${t.shamsiTime}\n\n`;
        }

        await sendTelegramMessage(chatId, resp);
        return NextResponse.json({ ok: true });
      }

      // Check if user is typing the merchant name for the most recent pending transaction
      // (created in the last 15 minutes, with category assigned but merchant still null)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const pendingTx = await prisma.transaction.findFirst({
        where: {
          createdAt: { gte: fifteenMinutesAgo },
          categoryId: { not: null },
          merchant: null,
        },
        orderBy: { createdAt: 'desc' },
        include: { category: true },
      });

      if (pendingTx && !text.startsWith('/')) {
        await prisma.transaction.update({
          where: { id: pendingTx.id },
          data: { merchant: text },
        });

        await sendTelegramMessage(
          chatId,
          `✨ نام پذیرنده به عنوان *${text}* برای تراکنش [${pendingTx.category?.icon} ${pendingTx.category?.persianName}] ثبت گردید.`
        );
        return NextResponse.json({ ok: true });
      }

      // Default fallback
      await sendTelegramMessage(
        chatId,
        'دستور ناشناخته. جهت مشاهده گزینه‌ها دستور /start را ارسال کنید.'
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
