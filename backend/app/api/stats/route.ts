import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';
import { TxType } from '@prisma/client';

export async function GET(req: NextRequest) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
  }

  try {
    // 1. Get latest transaction for current balance
    const latestTx = await prisma.transaction.findFirst({
      orderBy: { txTimestamp: 'desc' },
      select: { balance: true, shamsiDate: true, shamsiTime: true },
    });

    // 2. Define current month boundary (start of month UTC)
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    // 3. Fetch all transactions for this month
    const monthTransactions = await prisma.transaction.findMany({
      where: {
        txTimestamp: { gte: startOfMonth },
      },
      include: {
        category: {
          select: { id: true, persianName: true, icon: true, color: true },
        },
      },
    });

    let totalSpent = 0n;
    let totalIncome = 0n;
    const categoryTotals: Record<
      string,
      { id: string; name: string; icon: string; color: string; amount: bigint }
    > = {};

    for (const tx of monthTransactions) {
      if (tx.txType === TxType.TRANSFER_IN) {
        totalIncome += tx.amount;
      } else {
        totalSpent += tx.amount;
        const catKey = tx.categoryId || 'uncategorized';
        if (!categoryTotals[catKey]) {
          categoryTotals[catKey] = {
            id: tx.category?.id || 'uncategorized',
            name: tx.category?.persianName || 'سایر / نامشخص',
            icon: tx.category?.icon || '📦',
            color: tx.category?.color || '#94A3B8',
            amount: 0n,
          };
        }
        categoryTotals[catKey].amount += tx.amount;
      }
    }

    const spendingByCategory = Object.values(categoryTotals).map((item) => {
      const pct =
        totalSpent > 0n
          ? Number((item.amount * 10000n) / totalSpent) / 100
          : 0;
      return {
        id: item.id,
        name: item.name,
        icon: item.icon,
        color: item.color,
        amount: item.amount.toString(),
        percent: pct,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        currentBalance: latestTx ? latestTx.balance.toString() : '0',
        lastUpdatedDate: latestTx ? `${latestTx.shamsiDate} ${latestTx.shamsiTime}` : null,
        monthlyStats: {
          totalSpent: totalSpent.toString(),
          totalIncome: totalIncome.toString(),
          netFlow: (totalIncome - totalSpent).toString(),
          transactionCount: monthTransactions.length,
          spendingByCategory,
        },
      },
    });
  } catch (error: any) {
    console.error('Error calculating stats:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
