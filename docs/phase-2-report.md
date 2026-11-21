# گزارش پایان فاز ۲: پیاده‌سازی بک‌اند و پایگاه داده (Phase 2 Completion Report)

**پروژه:** TxTeller (سامانه ردیابی و مدیریت خودکار تراکنش‌های بانکی)  
**نسخه:** اختصاصی تک‌کاربره (بانک شهر / سرورلس Vercel + Supabase)  
**وضعیت فاز:** ✅ تکمیل‌شده، تست‌شده و آماده اتصال به اپ اندروید (فاز ۳)  
**تاریخ گزارش:** ۱۴۰۵/۰۸/۲۳ (۲۰۲۶-۱۱-۲۱)

---

## ۱. خلاصه اجرایی (Executive Summary)

تمامی اهداف و تسک‌های **فاز دوم (بک‌اند، دیتابیس و موتور پردازش پیامک)** با موفقیت پیاده‌سازی، بیلد و اعتبارسنجی شدند.

کدبیس بک‌اند در قالب یک پروژه استاندارد **Next.js 14 با TypeScript و Prisma ORM** در پوشه `backend/` مستقر گردید. موتور پردازش Regex با ۱۰ آزمون خودکار به صورت ۱۰۰٪ تست و تایید شد و فرآیند بیلد پروداکشن (`next build`) بدون هیچ‌گونه خطای Type یا کامپایل با موفقیت اجرا شد.

---

## ۲. ساختار فایل‌های پیاده‌سازی‌شده در فاز ۲

```
backend/
├── app/
│   └── api/
│       ├── messages/
│       │   └── route.ts             # POST: دریافت پیامک، فیلتر تکراری، استخراج، ثبت و ارسال به تلگرام
│       ├── transactions/
│       │   ├── route.ts             # GET: دریافت تراکنش‌ها با فیلتر، صفحه‌بندی و جستجو
│       │   └── [id]/
│       │       └── route.ts         # GET & PATCH: مشاهده جزئیات و ویرایش دسته‌بندی/نام پذیرنده
│       ├── stats/
│       │   └── route.ts             # GET: مانده فعلی، دخل و خرج ماهانه و نمودار درصدی دسته‌ها
│       ├── categories/
│       │   └── route.ts             # GET & POST: لیست و مدیریت دسته‌بندی‌ها
│       ├── telegram/
│       │   └── webhook/
│       │       └── route.ts         # POST: وب‌هوک ربات تلگرام (دکمه‌های شیشه‌ای و ثبت ۲ مرحله‌ای)
│       └── cron/
│           └── daily-report/
│               └── route.ts         # GET: گزارش شبانه Vercel Cron و بیدار نگه داشتن Supabase
├── lib/
│   ├── auth.ts                      # اعتبارسنجی هدر x-api-key و توکن Bearer
│   ├── hasher.ts                    # هش SHA-256 جهت Idempotency پیامک‌ها
│   ├── normalizer.ts                # تبدیل حروف عربی (ي/ك)، ارقام فارسی/عربی، و حذف تطویل
│   ├── parser.ts                    # موتور استخراج داده با Regex بانک شهر و ضد رمز پویا
│   ├── prisma.ts                    # کلاینت یگانه Prisma مجهز به Connection Pooling
│   ├── shamsi.ts                    # مبدل ریاضی تاریخ شمسی به میلادی (UTC+3:30)
│   └── telegram.ts                  # توابع ارسال پیام اعلان آنی و ساخت کیبورد شیشه‌ای
├── prisma/
│   ├── schema.prisma                # مدل کامل دیتابیس با فیلدهای BigInt و ایندکس‌ها
│   └── seed.ts                      # اسکریپت سیدینگ ۸ دسته‌بندی پیش‌فرض و کاربر مدیر
├── tests/
│   └── parser.test.ts               # ۱۰ تست واحد پوشش‌دهنده کل سناریوها
├── .env.example                     # راهنمای متغیرهای محیطی
├── package.json                     # پیکربندی اسکریپت‌ها و وابستگی‌ها
├── tsconfig.json                    # پیکربندی تایپ‌اسکریپت (ES2022 / Next.js)
└── vercel.json                      # تنظیم زمان‌بندی جاب روزانه ساعت ۲۳:۰۰
```

---

## ۳. قابلیت‌های کلیدی پیاده‌سازی‌شده

### ۱. موتور نرمال‌سازی و استخراج داده (Parser & Normalizer)
* تبدیل خودکار `ي` $\rightarrow$ `ی` و `ك` $\rightarrow$ `ک` و ارقام `۰-۹` $\rightarrow$ `0-9`.
* پشتیبانی کامل از هر ۴ الگوی ارسالی شما:
  * خرید با کارت (`PURCHASE`)
  * انتقال وجه کارتی - برداشت (`TRANSFER_OUT`)
  * انتقال وجه کارتی - واریز (`TRANSFER_IN`)
  * برداشت وجه از خودپرداز (`ATM_WITHDRAWAL`)
* **لایه حذف قطعی رمز پویا**: شناسایی کلمات `رمز:`، `رمز پویا`، و `زمان اعتبار رمز` و علامت‌گذاری با وضعیت `IGNORED` بدون ثبت در تراکنش‌ها.

### ۲. تضمین ویژگی Idempotency (عدم ثبت پیام تکراری)
* هر پیامک ورودی با الگوریتم **SHA-256** هش می‌شود. در صورت ارسال مجدد پیامک بر اثر قطعی اینترنت یا تلاش مجدد اپ اندروید، رکورد تکراری در سیستم ایجاد نمی‌شود و پاسخ تراکنش قبلی بازگردانده می‌شود.

### ۳. سیستم امنیت دسترسی (Security Middleware)
* تمامی نقاط دسترسی نیازمند ارسال هدر `x-api-key` یا `Authorization: Bearer <API_KEY>` هستند.

### ۴. سازوکار تلگرام دو مرحله‌ای با ۱ کلیک
* با دریافت تراکنش، پیامی زیبا به همراه ۸ دکمه دسته‌بندی (`🍔 خوراک روزانه`, `🚗 حمل و نقل`, ...) ارسال می‌شود.
* پس از لمس دکمه، دسته‌بندی در دیتابیس ثبت شده و ربات فوراً پیام می‌فرستد:  
  *«🏬 نام فروشگاه یا پذیرنده چیست؟ (یا دکمه رد شدن را بزنید)»*
* با تایپ نام (مانند «اسنپ») فیلد `merchant` تراکنش آپدیت می‌شود.

### ۵. تسک شبانه Vercel Cron و حل مشکل خواب Supabase
* اندپوینت `/api/cron/daily-report` طبق زمان‌بندی فایل `vercel.json` هر شب اجرا شده، گزارش دخل و خرج روز را به تلگرام ارسال کرده و کوئری روزانه آن مانع از غیرفعال‌شدن دیتابیس Supabase در پلن رایگان می‌شود.

---

## ۴. نتایج آزمون‌های واحد و بیلد (Verification Results)

### نتایج تست واحد (`npm test`):
```text
▶ Bank Shahr SMS Parser Engine
  ✔ should correctly parse a card transfer withdrawal (1.20ms)
  ✔ should correctly parse a card purchase (خريد با کارت) (0.18ms)
  ✔ should correctly parse a card transfer deposit (واریز به) (0.13ms)
  ✔ should correctly parse an ATM cash withdrawal (برداشت از کارت) (0.12ms)
  ✔ should REJECT and DROP an OTP / Dynamic password SMS (0.15ms)
  ✔ should REJECT and DROP general bank announcements (0.08ms)
  ✔ should REJECT and DROP login alerts (0.06ms)
  ✔ should normalize Arabic Yeh and Kaf characters and Persian digits (0.08ms)
  ✔ should accurately convert Shamsi date/time to Gregorian Date (0.11ms)
  ✔ should generate a deterministic SHA-256 hash for idempotency (0.19ms)
✔ Bank Shahr SMS Parser Engine (10 tests passed, 0 failed)
```

### نتایج بیلد پروداکشن (`next build`):
```text
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (8/8)
✓ Finalizing page optimization

Route (app)
┌ ƒ /api/categories
├ ƒ /api/cron/daily-report
├ ƒ /api/messages
├ ƒ /api/stats
├ ƒ /api/telegram/webhook
├ ƒ /api/transactions
└ ƒ /api/transactions/[id]
```

---

## ۵. چک‌لیست آمادگی برای شروع فاز ۳ (اپلیکیشن اندروید)

- [x] موتور API با قابلیت دریافت پیامک (`POST /api/messages`) آماده است.
- [x] امنیت احراز هویت با `x-api-key` فعال است.
- [x] الگوهای تطابق و فیلتر محلی در قالب کد کلاینت تدوین شده است.
- [x] ساختار و قرارداد خروجی JSON تراکنش‌ها نهایی شده است.

**گام بعدی:** ورود به **فاز ۳ (توسعه اپلیکیشن اندروید)** شامل پیاده‌سازی `BroadcastReceiver` با فیلتر محلی، صف آفلاین Room، ارسال مطمئن با `WorkManager` و رابط کاربری مدرن با Jetpack Compose.
