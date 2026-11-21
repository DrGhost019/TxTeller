import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';
import { hashMessage } from '@/lib/hasher';
import { parseBankShahrSms } from '@/lib/parser';
import { sendTransactionTelegramAlert } from '@/lib/telegram';
import { ParseStatus } from '@prisma/client';

export async function POST(req: NextRequest) {
  // 1. Authenticate Request
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
  }

  try {
    const bodyJson = await req.json();
    const { sender = 'Bank Shahr', body } = bodyJson;

    if (!body || typeof body !== 'string') {
      return NextResponse.json(
        { error: 'Bad Request: "body" field is required' },
        { status: 400 }
      );
    }

    // 2. Hash message body for Idempotency
    const messageHash = hashMessage(body);

    // 3. Check if already processed
    const existingRaw = await prisma.rawMessage.findUnique({
      where: { hash: messageHash },
      include: { transaction: true },
    });

    if (existingRaw) {
      if (existingRaw.transaction) {
        return NextResponse.json({
          success: true,
          duplicate: true,
          message: 'Transaction already recorded',
          transactionId: existingRaw.transaction.id,
          amount: existingRaw.transaction.amount.toString(),
          balance: existingRaw.transaction.balance.toString(),
          type: existingRaw.transaction.txType,
        });
      }

      return NextResponse.json({
        success: false,
        duplicate: true,
        message: 'Message was previously received but failed parsing',
        status: existingRaw.status,
      });
    }

    // 4. Parse SMS using Bank Shahr Engine
    const parseResult = parseBankShahrSms(body);

    // If OTP or marketing message was passed by mistake, mark IGNORED
    if (parseResult.isOtpOrPromo) {
      const rawIgnored = await prisma.rawMessage.create({
        data: {
          hash: messageHash,
          body,
          sender,
          status: ParseStatus.IGNORED,
          failureReason: parseResult.error,
        },
      });

      return NextResponse.json({
        success: false,
        ignored: true,
        message: parseResult.error,
        rawId: rawIgnored.id,
      });
    }

    // If Regex failed to match
    if (!parseResult.success || !parseResult.data) {
      const rawFailed = await prisma.rawMessage.create({
        data: {
          hash: messageHash,
          body,
          sender,
          status: ParseStatus.FAILED,
          failureReason: parseResult.error || 'Regex mismatch',
        },
      });

      return NextResponse.json(
        {
          success: false,
          error: parseResult.error || 'Failed to parse SMS format',
          rawId: rawFailed.id,
        },
        { status: 422 }
      );
    }

    // 5. Successful Parse: Persist RawMessage & Transaction
    const txData = parseResult.data;

    const createdTx = await prisma.$transaction(async (txPrisma) => {
      const raw = await txPrisma.rawMessage.create({
        data: {
          hash: messageHash,
          body,
          sender,
          status: ParseStatus.PARSED,
        },
      });

      const tx = await txPrisma.transaction.create({
        data: {
          bankName: txData.bankName,
          txType: txData.txType,
          title: txData.title,
          accountCard: txData.accountCard,
          amount: txData.amount,
          balance: txData.balance,
          shamsiDate: txData.shamsiDate,
          shamsiTime: txData.shamsiTime,
          txTimestamp: txData.txTimestamp,
          rawId: raw.id,
        },
      });

      return tx;
    });

    // 6. Fetch Categories & Trigger Telegram Alert (Non-blocking background push)
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, persianName: true, icon: true },
    });

    sendTransactionTelegramAlert(createdTx.id, txData, categories).catch((err) =>
      console.error('Telegram notification error:', err)
    );

    return NextResponse.json({
      success: true,
      transactionId: createdTx.id,
      amount: createdTx.amount.toString(),
      balance: createdTx.balance.toString(),
      type: createdTx.txType,
      shamsiDate: createdTx.shamsiDate,
      shamsiTime: createdTx.shamsiTime,
    });
  } catch (error: any) {
    console.error('Error in /api/messages:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
