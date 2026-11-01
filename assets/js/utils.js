/**
 * ابزارهای کمکی: تاریخ شمسی، ارقام فارسی، escape و ...
 * تمام تاریخ‌ها در داده‌ها به صورت میلادی ISO (YYYY-MM-DD) ذخیره می‌شوند
 * و فقط هنگام نمایش به شمسی تبدیل می‌شوند.
 */
(function () {
  'use strict';

  var FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  var AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
  var JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  var WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']; // index = getUTCDay()

  function div(a, b) { return Math.floor(a / b); }

  // الگوریتم تبدیل میلادی به شمسی
  function g2j(gy, gm, gd) {
    var gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var gy2 = gm > 2 ? gy + 1 : gy;
    var days = 355666 + 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + gdm[gm - 1];
    var jy = -1595 + 33 * div(days, 12053);
    days %= 12053;
    jy += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) { jy += div(days - 1, 365); days = (days - 1) % 365; }
    var jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
    var jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
    return [jy, jm, jd];
  }

  // الگوریتم تبدیل شمسی به میلادی
  function j2g(jy, jm, jd) {
    jy += 1595;
    var days = -355668 + 365 * jy + div(jy, 33) * 8 + div((jy % 33) + 3, 4) + jd +
      (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
    var gy = 400 * div(days, 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * div(--days, 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * div(days, 1461);
    days %= 1461;
    if (days > 365) { gy += div(days - 1, 365); days = (days - 1) % 365; }
    var gd = days + 1;
    var leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
    var sal = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var gm;
    for (gm = 0; gm < 13; gm++) {
      if (gd <= sal[gm]) break;
      gd -= sal[gm];
    }
    return [gy, gm, gd];
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function toFa(value) {
    return String(value).replace(/\d/g, function (d) { return FA_DIGITS[d]; });
  }

  function toEn(value) {
    return String(value)
      .replace(/[۰-۹]/g, function (d) { return FA_DIGITS.indexOf(d); })
      .replace(/[٠-٩]/g, function (d) { return AR_DIGITS.indexOf(d); });
  }

  function isoToUTC(iso) {
    var p = iso.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  }

  function utcToISO(date) {
    return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate());
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function addDays(iso, n) {
    var d = isoToUTC(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return utcToISO(d);
  }

  /** شروع هفته (شنبه) و پایان هفته (جمعه) برای تاریخ داده‌شده */
  function weekRange(iso) {
    var dow = isoToUTC(iso).getUTCDay(); // 0 = یکشنبه ... 6 = شنبه
    var back = (dow + 1) % 7;
    var start = addDays(iso, -back);
    return { from: start, to: addDays(start, 6) };
  }

 /** تاریخ شمسی یا میلادی را به قالب شمسی نمایش می‌دهد */
function formatJalali(iso) {
  if (!iso) return '—';

  var value = toEn(String(iso)).trim();

  // اگر تاریخ از قبل شمسی باشد
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value)) {
    var p = value.split('/').map(Number);
    return toFa(p[0] + '/' + pad(p[1]) + '/' + pad(p[2]));
  }

  // اگر تاریخ میلادی باشد
  var p = value.split('-').map(Number);
  if (p.length !== 3 || p.some(isNaN)) return '—';

  var j = g2j(p[0], p[1], p[2]);
  return toFa(j[0] + '/' + pad(j[1]) + '/' + pad(j[2]));
}

  /** ISO -> 'یکشنبه ۱۰ آبان ۱۴۰۵' */
  function formatJalaliLong(iso) {
    var p = iso.split('-').map(Number);
    var j = g2j(p[0], p[1], p[2]);
    var wd = WEEKDAYS[isoToUTC(iso).getUTCDay()];
    return wd + ' ' + toFa(j[2]) + ' ' + JALALI_MONTHS[j[1] - 1] + ' ' + toFa(j[0]);
  }

  /** '1405/08/10' (فارسی یا لاتین) -> ISO یا null در صورت نامعتبر؛ رشته خالی -> '' */
  function parseJalaliInput(text) {
    var s = toEn(text || '').trim();
    if (!s) return '';
    var m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (!m) return null;
    var jy = +m[1], jm = +m[2], jd = +m[3];
    if (jm < 1 || jm > 12 || jd < 1) return null;
    var maxDay = jm <= 6 ? 31 : (jm <= 11 ? 30 : 29);
    if (jd > maxDay + (jm === 12 && isJalaliLeap(jy) ? 1 : 0)) return null;
    var g = j2g(jy, jm, jd);
    return g[0] + '-' + pad(g[1]) + '-' + pad(g[2]);
  }

  function isJalaliLeap(jy) {
    // اسفند ۳۰ روزه است اگر روز ۳۰ اسفند به همان سال برگردد
    var g = j2g(jy, 12, 30);
    var back = g2j(g[0], g[1], g[2]);
    return back[0] === jy && back[1] === 12 && back[2] === 30;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** نرمال‌سازی متن برای جستجو: ارقام لاتین، حروف عربی به فارسی، بدون فاصله اضافی */
  function normalizeText(value) {
    return toEn(String(value || ''))
      .replace(/ي/g, 'ی').replace(/ك/g, 'ک')
      .replace(/‌/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  window.Utils = {
    toFa: toFa, toEn: toEn, pad: pad,
    g2j: g2j, j2g: j2g,
    todayISO: todayISO, addDays: addDays, weekRange: weekRange,
    formatJalali: formatJalali, formatJalaliLong: formatJalaliLong,
    parseJalaliInput: parseJalaliInput,
    escapeHtml: escapeHtml, normalizeText: normalizeText,
    JALALI_MONTHS: JALALI_MONTHS
  };

  window.LEAVE_TYPES = { daily: 'روزانه', hourly: 'ساعتی', sick: 'استعلاجی' };
  window.LEAVE_STATUS = { pending: 'در انتظار بررسی', approved: 'تأییدشده', rejected: 'ردشده' };
})();
