import { TxType } from '@prisma/client';
import { normalizeBankText } from './normalizer';
import { parseShamsiDateTime } from './shamsi';

export interface ParsedTransaction {
  bankName: string;
  txType: TxType;
  title: string;
  accountCard: string;
  amount: bigint;
  balance: bigint;
  shamsiDate: string;
  shamsiTime: string;
  txTimestamp: Date;
}

export interface ParseResult {
  success: boolean;
  data?: ParsedTransaction;
  error?: string;
  isOtpOrPromo?: boolean;
}

/**
 * Regex for Bank Shahr (بانک شهر) transaction SMS.
 * Extracts named groups: title, direction, account, amount, balance, date, time
 */
const BANK_SHAHR_REGEX =
  /^\*بانک شهر\*\s*\n(?<title>[^\n]+)\s*\n(?<direction>برداشت از|واریز به):(?<account>\S+)\s*\nمبلغ:(?<amount>[\d,]+)\s*ریال\s*\nموجودی:(?<balance>[\d,]+)\s*ریال\s*\n(?<date>\d{4}\/\d{1,2}\/\d{1,2})\s+(?<time>\d{1,2}:\d{2}:\d{2})/;

export function parseBankShahrSms(rawText: string): ParseResult {
  const normalized = normalizeBankText(rawText);

  // 1. Check for OTP / Security / Dynamic Passwords (Must be rejected)
  if (
    normalized.includes('رمز:') ||
    normalized.includes('رمز پویا') ||
    normalized.includes('زمان اعتبار رمز') ||
    normalized.includes('کد تایید') ||
    normalized.includes('ورود به همراه شهر')
  ) {
    return {
      success: false,
      isOtpOrPromo: true,
      error: 'Message dropped: OTP or security notification detected',
    };
  }

  // 2. Check for general non-financial announcements
  if (!normalized.includes('موجودی:')) {
    return {
      success: false,
      isOtpOrPromo: true,
      error: 'Message dropped: Not a financial transaction (missing balance label)',
    };
  }

  // 3. Match against Bank Shahr Regex
  const match = normalized.match(BANK_SHAHR_REGEX);
  if (!match || !match.groups) {
    return {
      success: false,
      isOtpOrPromo: false,
      error: 'Message did not match Bank Shahr pattern',
    };
  }

  const { title, direction, account, amount, balance, date, time } = match.groups;

  // 4. Determine Transaction Type
  let txType: TxType = TxType.WITHDRAWAL;
  const cleanTitle = title.trim();

  if (direction === 'واریز به') {
    txType = TxType.TRANSFER_IN;
  } else if (direction === 'برداشت از') {
    if (cleanTitle.includes('خرید')) {
      txType = TxType.PURCHASE;
    } else if (cleanTitle.includes('خودپرداز') || cleanTitle === 'برداشت از کارت') {
      txType = TxType.ATM_WITHDRAWAL;
    } else if (cleanTitle.includes('انتقال')) {
      txType = TxType.TRANSFER_OUT;
    } else {
      txType = TxType.WITHDRAWAL;
    }
  }

  // 5. Parse Numeric Amounts (IRR in BigInt)
  const cleanAmount = BigInt(amount.replace(/,/g, ''));
  const cleanBalance = BigInt(balance.replace(/,/g, ''));

  // 6. Parse Date & Time
  const txTimestamp = parseShamsiDateTime(date, time);

  return {
    success: true,
    data: {
      bankName: 'بانک شهر',
      txType,
      title: cleanTitle,
      accountCard: account,
      amount: cleanAmount,
      balance: cleanBalance,
      shamsiDate: date,
      shamsiTime: time,
      txTimestamp,
    },
  };
}
