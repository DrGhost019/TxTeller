import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseBankShahrSms } from '../lib/parser';
import { normalizeBankText } from '../lib/normalizer';
import { jalaliToGregorian, parseShamsiDateTime } from '../lib/shamsi';
import { hashMessage } from '../lib/hasher';
import { TxType } from '@prisma/client';

describe('Bank Shahr SMS Parser Engine', () => {
  it('should correctly parse a card transfer withdrawal', () => {
    const rawSms = `*بانک شهر*
انتقال وجه کارتي
برداشت از:ACCOUNT_NUMBER
مبلغ:2,511,000ريال
موجودي:513,185,551 ريال
1405/08/23 08:29:08`;

    const res = parseBankShahrSms(rawSms);
    assert.equal(res.success, true);
    assert.ok(res.data);
    assert.equal(res.data.bankName, 'بانک شهر');
    assert.equal(res.data.txType, TxType.TRANSFER_OUT);
    assert.equal(res.data.accountCard, 'ACCOUNT_NUMBER');
    assert.equal(res.data.amount, 2511000n);
    assert.equal(res.data.balance, 513185551n);
    assert.equal(res.data.shamsiDate, '1405/08/23');
    assert.equal(res.data.shamsiTime, '08:29:08');
  });

  it('should correctly parse a card purchase (خريد با کارت)', () => {
    const rawSms = `*بانک شهر*
خريد با کارت
برداشت از:ACCOUNT_NUMBER
مبلغ:3,609,000ريال
موجودي:509,576,551 ريال
1405/08/23 17:18:05`;

    const res = parseBankShahrSms(rawSms);
    assert.equal(res.success, true);
    assert.ok(res.data);
    assert.equal(res.data.txType, TxType.PURCHASE);
    assert.equal(res.data.accountCard, 'ACCOUNT_NUMBER');
    assert.equal(res.data.amount, 3609000n);
    assert.equal(res.data.balance, 509576551n);
    assert.equal(res.data.shamsiDate, '1405/08/23');
    assert.equal(res.data.shamsiTime, '17:18:05');
  });

  it('should correctly parse a card transfer deposit (واریز به)', () => {
    const rawSms = `*بانک شهر*
انتقال وجه کارتي
واريز به:ACCOUNT_NUMBER
مبلغ:3,200,000ريال
موجودي:536,371,151ريال
1405/08/19 21:04:45`;

    const res = parseBankShahrSms(rawSms);
    assert.equal(res.success, true);
    assert.ok(res.data);
    assert.equal(res.data.txType, TxType.TRANSFER_IN);
    assert.equal(res.data.accountCard, 'ACCOUNT_NUMBER');
    assert.equal(res.data.amount, 3200000n);
    assert.equal(res.data.balance, 536371151n);
  });

  it('should correctly parse an ATM cash withdrawal (برداشت از کارت)', () => {
    const rawSms = `*بانک شهر*
برداشت از کارت
برداشت از:ACCOUNT_NUMBER
مبلغ:2,010,000ريال
موجودي:546,957,820 ريال
1405/07/25 12:53:14`;

    const res = parseBankShahrSms(rawSms);
    assert.equal(res.success, true);
    assert.ok(res.data);
    assert.equal(res.data.txType, TxType.ATM_WITHDRAWAL);
    assert.equal(res.data.accountCard, 'ACCOUNT_NUMBER');
    assert.equal(res.data.amount, 2010000n);
    assert.equal(res.data.balance, 546957820n);
    assert.equal(res.data.shamsiDate, '1405/07/25');
  });

  it('should REJECT and DROP an OTP / Dynamic password SMS', () => {
    const otpSms = `*بانک شهر*
انتقال به 585983*3277
مبلغ: 2,500,000 ريال
رمز: 529000
زمان اعتبار رمز: 08:30:53
تاريخ: 1405/08/23 08:28:53`;

    const res = parseBankShahrSms(otpSms);
    assert.equal(res.success, false);
    assert.equal(res.isOtpOrPromo, true);
    assert.match(res.error || '', /OTP or security notification detected/);
  });

  it('should REJECT and DROP general bank announcements', () => {
    const promoSms = `بانک شهر
مشتری گرامی به منظور بروزرسانی زیرساخت ها، سامانههای بانک شهر از ساعت 1 بامداد جمعه 8 آبان، حداکثر به مدت 6 ساعت با اختلال مواجه خواهد بود. از صبر و همراهی شما سپاسگزاریم.`;

    const res = parseBankShahrSms(promoSms);
    assert.equal(res.success, false);
    assert.equal(res.isOtpOrPromo, true);
  });

  it('should REJECT and DROP login alerts', () => {
    const loginSms = `*بانک شهر*
ورود به همراه شهر
تاريخ : 1405/8/30
ساعت : 13:48:59`;

    const res = parseBankShahrSms(loginSms);
    assert.equal(res.success, false);
    assert.equal(res.isOtpOrPromo, true);
  });

  it('should normalize Arabic Yeh and Kaf characters and Persian digits', () => {
    const arabicText = 'مبلغ: ۲،۵۱۱،۰۰۰ ريـال - بانک كارتي';
    const normalized = normalizeBankText(arabicText);
    assert.ok(!normalized.includes('ي'));
    assert.ok(!normalized.includes('ك'));
    assert.ok(!normalized.includes('۲'));
    assert.ok(!normalized.includes('ـ')); // Tatweel removed
    assert.ok(normalized.includes('2,511,000'));
    assert.ok(normalized.includes('کارتی'));
  });

  it('should accurately convert Shamsi date/time to Gregorian Date', () => {
    const { gy, gm, gd } = jalaliToGregorian(1405, 8, 23);
    assert.equal(gy, 2026);
    assert.equal(gm, 11);
    assert.equal(gd, 14);

    const date = parseShamsiDateTime('1405/08/23', '08:29:08');
    assert.equal(date.getUTCFullYear(), 2026);
    assert.equal(date.getUTCMonth(), 10); // 10 is November (0-indexed)
    assert.equal(date.getUTCDate(), 14);
  });

  it('should generate a deterministic SHA-256 hash for idempotency', () => {
    const text1 = '*بانک شهر*\nخريد با کارت';
    const text2 = '  *بانک شهر*\nخريد با کارت  ';
    assert.equal(hashMessage(text1), hashMessage(text2));
    assert.equal(hashMessage(text1).length, 64);
  });
});
