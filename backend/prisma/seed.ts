import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  {
    name: 'DAILY_FOOD',
    persianName: 'خوراک روزانه',
    icon: '🍔',
    color: '#10B981',
    description: 'سوپرمارکت، نان، میوه، ناهار/شام، قهوه و آبمیوه',
    isSystem: true,
  },
  {
    name: 'TRANSPORT',
    persianName: 'حمل و نقل',
    icon: '🚗',
    color: '#3B82F6',
    description: 'مترو، اتوبوس، اسنپ/تپسی، بنزین، پارکینگ، سرویس خودرو',
    isSystem: true,
  },
  {
    name: 'HOUSING',
    persianName: 'مسکن و قبوض',
    icon: '🏠',
    color: '#6366F1',
    description: 'اجاره، شارژ ساختمان، برق، آب، گاز، اینترنت، تلفن',
    isSystem: true,
  },
  {
    name: 'HOUSEHOLD',
    persianName: 'ملزومات خانه',
    icon: '🧴',
    color: '#EC4899',
    description: 'شوینده، دستمال، بهداشتی، وسایل آشپزخانه',
    isSystem: true,
  },
  {
    name: 'PERSONAL',
    persianName: 'شخصی و سلامت',
    icon: '👕',
    color: '#8B5CF6',
    description: 'پوشاک، بهداشتی شخصی، دارو، ویزیت، ورزش و باشگاه',
    isSystem: true,
  },
  {
    name: 'LEISURE',
    persianName: 'تفریح و سرگرمی',
    icon: '☕',
    color: '#F59E0B',
    description: 'کافه، سینما، اشتراک‌ها، کتاب، بازی و سفر',
    isSystem: true,
  },
  {
    name: 'DEBT_LOAN',
    persianName: 'اقساط و بدهی',
    icon: '💳',
    color: '#EF4444',
    description: 'بازپرداخت وام، خرید قسطی، تسویه قرض‌ها',
    isSystem: true,
  },
  {
    name: 'MISC',
    persianName: 'سایر و پیش‌بینی‌نشده',
    icon: '📦',
    color: '#64748B',
    description: 'هدیه، جریمه، خسارت، خرابی‌های ناگهانی',
    isSystem: true,
  },
];

async function main() {
  console.log('Seeding initial categories...');
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: cat,
      create: cat,
    });
  }
  console.log(`Successfully seeded ${DEFAULT_CATEGORIES.length} default categories.`);

  // Check or initialize UserConfig
  const existingConfig = await prisma.userConfig.findFirst();
  if (!existingConfig) {
    const generatedApiKey = process.env.API_KEY || randomBytes(16).toString('hex');
    await prisma.userConfig.create({
      data: {
        apiKey: generatedApiKey,
        telegramChatId: process.env.TELEGRAM_CHAT_ID || null,
        masterPassword: process.env.MASTER_PASSWORD || 'txteller-admin-2026',
      },
    });
    console.log(`Created initial UserConfig with API Key: ${generatedApiKey}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
