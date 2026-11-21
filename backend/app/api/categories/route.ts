import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';

export async function GET(req: NextRequest) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
  }

  try {
    const categories = await prisma.category.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: categories.map((c) => ({
        ...c,
        transactionCount: c._count.transactions,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, persianName, icon, color, description } = body;

    if (!name || !persianName || !icon || !color) {
      return NextResponse.json(
        { error: 'Missing required fields: name, persianName, icon, color' },
        { status: 400 }
      );
    }

    const category = await prisma.category.create({
      data: {
        name,
        persianName,
        icon,
        color,
        description,
      },
    });

    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
