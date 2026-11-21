# TxTeller 💳📊
> **Automated Bank Transaction Tracking & Personal Finance Management**  
> سامانه مدیریت و ردیابی خودکار تراکنش‌های بانکی بر پایه پیامک‌های بانک شهر

---

## 📌 Overview

**TxTeller** is a modern, privacy-first personal finance platform designed to automatically capture, parse, categorize, and report bank transactions without manual entry. 

Built specifically for the Iranian banking ecosystem starting with **Bank Shahr (بانک شهر)**, TxTeller pairs a lightweight native Android SMS forwarder with a serverless Next.js core API, PostgreSQL (via Supabase), and an interactive Telegram bot.

---

## 🚀 Key Features

* **🛡️ Zero OTP Leakage (Local Android Whitelist)**:
  * Strict local whitelist gate ensuring OTPs (`رمز پویا`), marketing SMS, and login alerts are dropped immediately on the device and never leave your phone.
* **🔒 Privacy & Account Number Protection**:
  * Real bank account and card numbers are kept strictly private and excluded from Git via `.env`. Documentation and test suites utilize generic `ACCOUNT_NUMBER` placeholders.
* **⚡ High-Precision Regex Engine**:
  * Extracts transaction direction (`برداشت` vs `واریز`), amounts in Iranian Rials (`BigInt`), remaining account balance, account/card references, and Shamsi timestamps.
  * Normalizes Arabic characters (`ي`, `ك`) to Persian (`ی`, `ک`), standardizes Persian/Arabic digits to ASCII, and strips Tatweel (`ـ`).
* **🔄 Idempotency & Deduplication**:
  * SHA-256 message hashing guarantees no duplicate records even during offline sync retries.
* **💬 2-Step Telegram Conversational Flow**:
  * Instant alert with 8 inline category buttons (Daily Food, Transportation, Housing, etc.).
  * Interactive follow-up asking for the merchant/store name (e.g., *Uber*, *Snapp*, *Hyperstar*) with a quick `[ ⏭ Skip ]` button.
* **🌐 100% Free & Always-On Hosting Architecture**:
  * **Database**: Supabase Free Tier (PostgreSQL with transaction pooler).
  * **API & Web**: Vercel Serverless (Hobby Tier).
  * **Telegram Bot**: Runs via Telegram Webhooks directly on Vercel.
  * **Vercel Cron**: Scheduled daily report at 23:00 IRST keeps the Supabase database warm, naturally preventing the 7-day inactivity pause!

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                    Android Phone (Private)                         │
│                                                                    │
│  [ Bank Shahr SMS ]                                                │
│          │                                                         │
│          ▼                                                         │
│  [ Local Whitelist & OTP Filter ] ──(Non-financial/OTP)──► [Drop]  │
│          │                                                         │
│          ▼                                                         │
│  [ Room DB ] ──► [ WorkManager ]                                   │
└─────────────────────────────────┬──────────────────────────────────┘
                                  │ HTTPS POST /api/messages
                                  │ Header: x-api-key: <MASTER_KEY>
                                  ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Central Next.js API (Vercel)                    │
│                                                                    │
│  1. API Key Authentication                                         │
│  2. SHA-256 Hash Deduplication Check                               │
│  3. Normalization & Regex Extraction                               │
│  4. Save RawMessage & Transaction                                  │
│  5. Dispatch Telegram Alert with 8 Inline Categories               │
└──────────────────┬──────────────────────────────┬──────────────────┘
                   │                              │
                   ▼                              ▼
┌──────────────────────────────────┐  ┌──────────────────────────────┐
│      PostgreSQL (Supabase)       │  │    Telegram Bot (Webhook)    │
│                                  │  │                              │
│ - Transactions (BigInt)          │  │ - Instant Push Alerts        │
│ - 8 Pre-seeded Categories        │  │ - 1-Click Categorization     │
│ - Raw Messages & Hashes          │  │ - Merchant Name Input        │
└──────────────────────────────────┘  └──────────────────────────────┘
```

---

## 📁 Repository Structure

```
.
├── backend/                  # Next.js 14 API, Prisma ORM, Parser & Webhook
│   ├── app/api/              # Serverless API routes (messages, transactions, stats, cron, telegram)
│   ├── lib/                  # Core modules (parser, normalizer, shamsi, hasher, auth, telegram)
│   ├── prisma/               # schema.prisma & seed.ts
│   ├── tests/                # Automated unit tests for regex parser
│   └── vercel.json           # Vercel Cron configuration (Daily 23:00 IRST)
├── database/                 # Prisma database schema definition
├── docs/                     # Specifications, architecture, and phase roadmaps
│   ├── architecture.md       # Full architecture and API contracts
│   ├── phase.md              # 6-Phase implementation plan
│   └── regex-spec.md         # Bank Shahr regex & normalization specification
├── report/                   # Phase completion reports
│   ├── phase-1-report.md     # Phase 1: Analysis & Design
│   └── phase-2-report.md     # Phase 2: Backend & Database Engine
├── frontend/                 # Web Dashboard (Phase 5)
├── mobile/                   # Android Application (Phase 3)
└── telegram-bot/             # Standalone bot assets (if needed)
```

---

## 🧪 Testing

The backend includes a comprehensive test suite covering all transaction types, OTP filtering, character normalizations, and Shamsi date calculations:

```bash
cd backend
npm test
```

**Results:**
```text
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
```

---

## ⚙️ Getting Started (Local Development)

### 1. Prerequisites
* **Node.js**: v18+ (tested on Node v20/v26)
* **PostgreSQL Database**: Free instance from [Supabase](https://supabase.com) or [Neon](https://neon.tech)

### 2. Setup Backend
```bash
cd backend
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```
*(Make sure to never commit your real `.env` file!)*

### 4. Database Setup & Seeding
```bash
npx prisma generate
npx prisma db push
npm run prisma:seed
```

### 5. Start Development Server
```bash
npm run dev
```

---

## 🗺️ Project Phases

* [x] **Phase 1: Design & Architecture** — Completed ([Report](report/phase-1-report.md))
* [x] **Phase 2: Backend & Database** — Completed ([Report](report/phase-2-report.md))
* [x] **Phase 3: Android App** — Completed ([Report](report/phase-3-report.md))
* [ ] **Phase 4: Telegram Bot Polish** — Interactive charts and digest views
* [ ] **Phase 5: Web Dashboard** — Next.js responsive management UI
* [ ] **Phase 6: Deployment & E2E Testing** — Production deployment on Vercel & Supabase
