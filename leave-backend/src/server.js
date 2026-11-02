
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { allRows, updateStatus } = require('./sheets');

const app = express();

app.use(helmet());

const allowed = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin || allowed.includes(origin)) return cb(null, true);
    cb(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '30kb' }));

app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false
}));

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  try {
    if (!token) throw new Error();
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'برای دسترسی باید وارد شوید.' });
  }
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));

  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function verifyPassword(password) {
  const stored = process.env.ADMIN_PASSWORD_HASH || '';
  const [scheme, salt, hex] = stored.split('$');

  if (scheme !== 'scrypt' || !salt || !hex) return false;

  const actual = crypto.scryptSync(password, salt, 64).toString('hex');

  return safeEqual(actual, hex);
}

function mapRequest(r) {
  const leave = String(r['Leave Type'] || '').trim();
const typeMap = {
  'روزانه': 'daily',
  'مرخصی روزانه': 'daily',

  'ساعتی': 'hourly',
  'مرخصی ساعتی': 'hourly',

  'استعلاجی': 'sick',
  'مرخصی استعلاجی': 'sick',

  daily: 'daily',
  hourly: 'hourly',
  sick: 'sick'
};
  const status = String(r.Status || '').trim();

  return {
    id: String(r['Request ID'] || ''),
    fullName: r['Full Name'] || '',
    nationalId: r['National ID'] || '',
    leaveType: typeMap[leave] || leave,
    leaveTypeLabel: leave,
    startDate: r['Start Date'] || '',
    endDate: r['End Date'] || '',
    reason: r.Reason || '',
    telegramId: String(r['Telegram ID'] || ''),
    status,
    step: String(r.Step || '').trim(),
    rowNumber: r._rowNumber
  };
}

async function telegramNotify(chatId, status, person) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  }

  if (!chatId) {
    throw new Error('Telegram ID is empty for this request');
  }

  const approved = status === 'approved';

  const text = approved
    ? `سلام ${person || 'کاربر'} عزیز
درخواست مرخصی شما تأیید شد. ✅`
    : `سلام ${person || 'کاربر'} عزیز
درخواست مرخصی شما رد شد. ❌`;

  const response = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text
      })
    }
  );

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(data.description || 'Telegram notification failed');
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'leave-management-api'
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!process.env.JWT_SECRET || String(process.env.JWT_SECRET).length < 32) {
    return res.status(503).json({
      error: 'JWT_SECRET is not configured securely'
    });
  }

  if (
    !safeEqual(username || '', process.env.ADMIN_USERNAME || 'admin') ||
    !verifyPassword(password || '')
  ) {
    return res.status(401).json({
      error: 'نام کاربری یا رمز عبور اشتباه است.'
    });
  }

  const token = jwt.sign(
    { username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      username,
      displayName: 'مدیر سیستم'
    }
  });
});

app.get('/api/requests', auth, async (req, res, next) => {
  try {
    let items = (await allRows())
      .map(mapRequest)
      .filter(r =>
        r.step === 'completed' &&
        ['pending', 'approved', 'rejected'].includes(r.status)
      );

    const { search, type, status } = req.query;

    if (status) {
      items = items.filter(r => r.status === status);
    }

    if (type) {
      items = items.filter(
        r => r.leaveType === type || r.leaveTypeLabel === type
      );
    }

    if (search) {
      const q = String(search).toLowerCase();

      items = items.filter(r =>
        [r.fullName, r.nationalId, r.id]
          .some(v => String(v).toLowerCase().includes(q))
      );
    }

    items.sort((a, b) => b.rowNumber - a.rowNumber);

    res.json(items);
  } catch (e) {
    next(e);
  }
});

app.get('/api/requests/:id', auth, async (req, res, next) => {
  try {
    const item = (await allRows())
      .map(mapRequest)
      .find(r => r.id === req.params.id);

    if (!item) {
      return res.status(404).json({
        error: 'درخواست پیدا نشد.'
      });
    }

    res.json(item);
  } catch (e) {
    next(e);
  }
});

async function decide(req, res, next, status) {
  try {
    const row = (await allRows()).find(
      r => String(r['Request ID']) === req.params.id
    );

    if (!row || String(row.Step || '').trim() !== 'completed') {
      return res.status(404).json({
        error: 'درخواست پیدا نشد.'
      });
    }

    if (String(row.Status || '').trim() !== 'pending') {
      return res.status(409).json({
        error: 'وضعیت این درخواست قبلاً تعیین شده است.'
      });
    }

    await updateStatus(row._rowNumber, status);

    try {
      await telegramNotify(
        row['Telegram ID'],
        status,
        row['Full Name']
      );
    } catch (e) {
      return res.status(502).json({
        ...mapRequest({ ...row, Status: status }),
        notification: 'failed',
        notificationError: e.message,
        warning: 'وضعیت در شیت ذخیره شد اما ارسال پیام تلگرام ناموفق بود.'
      });
    }

    res.json({
      ...mapRequest({ ...row, Status: status }),
      notification: 'sent'
    });
  } catch (e) {
    next(e);
  }
}

app.patch('/api/requests/:id/approve', auth, (req, res, next) => {
  decide(req, res, next, 'approved');
});

app.patch('/api/requests/:id/reject', auth, (req, res, next) => {
  decide(req, res, next, 'rejected');
});

// Convert Persian and Arabic digits to English
function toEnglishDigits(value) {
  return String(value || '').replace(/[۰-۹٠-٩]/g, d => {
    const digits = '۰۱۲۳۴۵۶۷۸۹';
    const arabicDigits = '٠١٢٣٤٥٦٧٨٩';

    const index = digits.indexOf(d);

    return String(
      index >= 0 ? index : arabicDigits.indexOf(d)
    );
  });
}

// Convert Jalali dates to Gregorian dates in YYYY-MM-DD format
function jalaliToGregorianISO(value) {
  const s = toEnglishDigits(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

 const m = s.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);

  if (!m) return '';

  let jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);

  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) {
    return '';
  }

  jy += 1595;

  let days = -355668
    + 365 * jy
    + Math.floor(jy / 33) * 8
    + Math.floor(((jy % 33) + 3) / 4)
    + jd
    + (jm < 7
      ? (jm - 1) * 31
      : (jm - 7) * 30 + 186);

  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;

    if (days >= 365) days++;
  }

  gy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  let gd = days + 1;

  const leap =
    (gy % 4 === 0 && gy % 100 !== 0) ||
    gy % 400 === 0;

  const months = [
    0, 31, leap ? 29 : 28, 31, 30, 31,
    30, 31, 31, 30, 31, 30, 31
  ];

  let gm = 1;

  while (gm <= 12 && gd > months[gm]) {
    gd -= months[gm];
    gm++;
  }

  if (gm > 12) return '';

  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

// Weekly leave report
app.get('/api/reports/weekly', auth, async (req, res, next) => {
  try {
    const from = jalaliToGregorianISO(req.query.from || '');
    const to = jalaliToGregorianISO(req.query.to || '');

    if (!from || !to) {
      return res.status(400).json({
        error: 'تاریخ شروع یا پایان معتبر نیست.'
      });
    }

    if (from > to) {
      return res.status(400).json({
        error: 'تاریخ شروع نباید بعد از تاریخ پایان باشد.'
      });
    }

    const items = (await allRows())
      .map(mapRequest)
      .filter(r => {
        if (
          r.status !== 'approved' ||
          r.step !== 'completed'
        ) {
          return false;
        }

        const start = jalaliToGregorianISO(r.startDate);
        const end = jalaliToGregorianISO(r.endDate);

        if (!start || !end) return false;

        return start <= to && end >= from;
      });

    res.json(items);
  } catch (e) {
    next(e);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(500).json({
    error: 'خطای داخلی سرور',
    detail: process.env.NODE_ENV === 'development'
      ? err.message
      : undefined
  });
});

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`Leave API listening on ${port}`);
});
