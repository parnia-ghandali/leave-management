/**
 * تنظیمات مرکزی برنامه
 * ----------------------------------------------------------
 * برای اتصال به Backend:
 *   1) USE_MOCK را false کنید.
 *   2) API_BASE_URL را با آدرس سرویس Backend (مثلاً سرویس شما روی Render) جایگزین کنید.
 *
 * هشدار: هرگز توکن ربات تلگرام، کلید API یا هر راز دیگری را در فایل‌های
 * Front-end قرار ندهید. این فایل‌ها برای همه کاربران قابل مشاهده‌اند.
 */
window.CONFIG = {
  USE_MOCK: true,
  API_BASE_URL: 'https://YOUR-BACKEND.onrender.com/api', // فقط جای‌نگهدار؛ در نسخه نمایشی استفاده نمی‌شود
  COMPANY_NAME: 'شرکت آریانا',
  PAGE_SIZE: 8,
  STORAGE_KEYS: {
    requests: 'leave_demo_requests_v1',
    session: 'leave_demo_session_v1'
  },
  // فقط برای نسخه نمایشی؛ در نسخه واقعی احراز هویت باید سمت سرور انجام شود
  DEMO_CREDENTIALS: { username: 'admin', password: 'admin123', displayName: 'مدیر سیستم' }
};
