import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
  }

  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        category: true,
        rawMessage: {
          select: { id: true, body: true, sender: true, receivedAt: true },
        },
      },
    });

    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...tx,
        amount: tx.amount.toString(),
        balance: tx.balance.toString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid API Key' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { categoryId, merchant, note } = body;

    const dataToUpdate: any = {};
    if (categoryId !== undefined) dataToUpdate.categoryId = categoryId;
    if (merchant !== undefined) dataToUpdate.merchant = merchant;
    if (note !== undefined) dataToUpdate.note = note;

    const updated = await prisma.transaction.update({
      where: { id: params.id },
      data: dataToUpdate,
      include: {
        category: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        amount: updated.amount.toString(),
        balance: updated.balance.toString(),
      },
    });
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
