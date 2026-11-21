import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';
import { TxType } from '@prisma/client';

export async function GET(req: NextRequest) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const typeParam = searchParams.get('type') as TxType | null;
  const categoryId = searchParams.get('categoryId');
  const from = searchParams.get('from'); // ISO string or YYYY-MM-DD
  const to = searchParams.get('to');
  const search = searchParams.get('search');

  const where: any = {};

  if (typeParam && Object.values(TxType).includes(typeParam)) {
    where.txType = typeParam;
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (from || to) {
    where.txTimestamp = {};
    if (from) where.txTimestamp.gte = new Date(from);
    if (to) where.txTimestamp.lte = new Date(to);
  }

  if (search) {
    where.OR = [
      { merchant: { contains: search, mode: 'insensitive' } },
      { note: { contains: search, mode: 'insensitive' } },
      { title: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { txTimestamp: 'desc' },
        include: {
          category: {
            select: { id: true, name: true, persianName: true, icon: true, color: true },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    // Serialize BigInt to string for JSON output
    const serialized = transactions.map((t) => ({
      ...t,
      amount: t.amount.toString(),
      balance: t.balance.toString(),
    }));

    return NextResponse.json({
      success: true,
      data: serialized,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + transactions.length < total,
      },
    });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
