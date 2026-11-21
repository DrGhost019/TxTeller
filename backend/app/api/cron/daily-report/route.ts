import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/lib/telegram';

export async function GET(req: NextRequest) {
  // Optional: Verify Vercel Cron Secret if set
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized Cron Trigger' }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  try {
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    // 1. Fetch today's transactions (this query keeps the database warm!)
    const todayTxs = await prisma.transaction.findMany({
      where: { txTimestamp: { gte: startOfDay } },
      include: { category: true },
      orderBy: { txTimestamp: 'asc' },
    });

    const latestTx = await prisma.transaction.findFirst({
      orderBy: { txTimestamp: 'desc' },
      select: { balance: true },
    });

    let totalSpent = 0n;
    let totalIncome = 0n;
    for (const t of todayTxs) {
      if (t.txType === 'TRANSFER_IN') {
        totalIncome += t.amount;
      } else {
        totalSpent += t.amount;
      }
    }

    const spentFmt = formatCurrency(totalSpent);
    const incomeFmt = formatCurrency(totalIncome);
    const balanceFmt = latestTx ? formatCurrency(latestTx.balance) : { toman: '0', rial: '0' };

    const reportMessage = `
🌙 *گزارش پایان روز TxTeller*

🔴 مجموع مخارج امروز: *${spentFmt.toman} تومان*
🟢 مجموع واریز امروز: *${incomeFmt.toman} تومان*
🏦 مانده نهایی حساب: *${balanceFmt.toman} تومان*
🔢 تعداد کل تراکنش‌ها: *${todayTxs.length}*

${todayTxs.length > 0 ? '✨ شب شما خوش و مالی شما پربرکت باد.' : 'امروز هیچ تراکنشی ثبت نشد.'}
`.trim();

    // 2. Send report to Telegram
    if (token && chatId) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: reportMessage,
          parse_mode: 'Markdown',
        }),
      });
    }

    return NextResponse.json({
      success: true,
      transactionCount: todayTxs.length,
      totalSpent: totalSpent.toString(),
      totalIncome: totalIncome.toString(),
      message: 'Daily report generated and sent to Telegram successfully',
    });
  } catch (error: any) {
    console.error('Error generating daily report:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
