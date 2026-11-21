/**
 * Converts a Jalali (Shamsi) date to Gregorian date.
 * Based on the mathematical Jalaali algorithm by Kazimierz M. Borkowski.
 */
export function jalaliToGregorian(
  jy: number,
  jm: number,
  jd: number
): { gy: number; gm: number; gd: number } {
  jy = jy - 979;
  jm = jm - 1;
  jd = jd - 1;

  let j_day_no =
    365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4);
  for (let i = 0; i < jm; ++i) {
    j_day_no += i < 6 ? 31 : 30;
  }
  j_day_no += jd;

  let g_day_no = j_day_no + 79;

  let gy =
    1600 + 400 * Math.floor(g_day_no / 146097); /* 146097 = 365*400 + 400/4 - 400/100 + 400/400 */
  g_day_no = g_day_no % 146097;

  let leap = true;
  if (g_day_no >= 36525) {
    /* 36525 = 365*100 + 100/4 */
    g_day_no--;
    gy += 100 * Math.floor(g_day_no / 36524); /* 36524 = 365*100 + 100/4 - 100/100 */
    g_day_no = g_day_no % 36524;

    if (g_day_no >= 365) {
      g_day_no++;
    } else {
      leap = false;
    }
  }

  gy += 4 * Math.floor(g_day_no / 1461); /* 1461 = 365*4 + 4/4 */
  g_day_no %= 1461;

  if (g_day_no >= 366) {
    leap = false;
    g_day_no--;
    gy += Math.floor(g_day_no / 365);
    g_day_no = g_day_no % 365;
  }

  const g_days_in_month = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  let gm = 0;
  for (let i = 0; i < 12; i++) {
    if (g_day_no < g_days_in_month[i]) {
      gm = i + 1;
      break;
    }
    g_day_no -= g_days_in_month[i];
  }
  const gd = g_day_no + 1;

  return { gy, gm, gd };
}

/**
 * Parses Shamsi date (YYYY/MM/DD) and time (HH:mm:ss) strings
 * into a standard JavaScript UTC Date object.
 */
export function parseShamsiDateTime(shamsiDate: string, shamsiTime: string): Date {
  const [jy, jm, jd] = shamsiDate.split('/').map((s) => parseInt(s, 10));
  const [hours, minutes, seconds] = shamsiTime.split(':').map((s) => parseInt(s, 10));

  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);

  // Iran Standard Time is UTC+3:30 (or UTC+3:30 without daylight saving)
  // We construct the date in UTC representing that precise moment:
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoString = `${gy}-${pad(gm)}-${pad(gd)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}+03:30`;

  return new Date(isoString);
}
