/**
 * داده‌های آزمایشی (Mock Data)
 * تاریخ‌ها نسبت به «شروع هفته جاری (شنبه)» ساخته می‌شوند تا گزارش هفتگی
 * در هر زمانی که صفحه باز شود داده نمایشی داشته باشد.
 * نمونه داده فقط یک‌بار در LocalStorage ذخیره می‌شود.
 */
(function () {
  'use strict';

  function buildSeed() {
    var W = Utils.weekRange(Utils.todayISO()).from; // شنبه هفته جاری
    var d = function (offset) { return Utils.addDays(W, offset); };
    var today = Utils.todayISO();
    // تاریخ ثبت هرگز در آینده نباشد
    var reg = function (offset) { var x = d(offset); return x > today ? today : x; };

    var rows = [
      ['علی رضایی', '0012345678', 'daily', d(1), d(3), reg(-6), 'شرکت در مراسم خانوادگی در شهرستان', '5123456701', 'approved'],
      ['مریم احمدی', '0023456789', 'hourly', d(1), d(1), reg(-1), 'مراجعه به بانک و انجام امور اداری شخصی', '5123456702', 'approved', '10:00', '13:00'],
      ['حسین کریمی', '0034567890', 'sick', d(-2), d(2), reg(-3), 'استراحت پزشکی طبق نظر پزشک معالج', '5123456703', 'approved'],
      ['زهرا موسوی', '0045678901', 'daily', d(8), d(10), reg(0), 'سفر زیارتی همراه خانواده', '5123456704', 'pending'],
      ['محمد صادقی', '0056789012', 'hourly', d(2), d(2), reg(1), 'حضور در جلسه مدرسه فرزند', '5123456705', 'pending', '14:00', '17:00'],
      ['فاطمه حسینی', '0067890123', 'sick', d(-10), d(-8), reg(-12), 'ویزیت پزشک متخصص و انجام آزمایش‌ها', '5123456706', 'rejected'],
      ['رضا نوری', '0078901234', 'daily', d(10), d(14), reg(-3), 'استفاده از مرخصی استحقاقی', '5123456707', 'approved'],
      ['سارا محمدی', '0089012345', 'daily', d(3), d(5), reg(-2), 'انجام امور شخصی و رفت‌وآمد بین‌شهری', '5123456708', 'rejected'],
      ['امیر جعفری', '0090123456', 'sick', d(1), d(2), reg(1), 'سرماخوردگی شدید و تب', '5123456709', 'pending'],
      ['نرگس کاظمی', '0101234567', 'daily', d(-20), d(-18), reg(-30), 'مراسم عروسی یکی از بستگان', '5123456710', 'approved'],
      ['پرهام قاسمی', '0112345678', 'hourly', d(4), d(4), reg(0), 'مراجعه به اداره ثبت احوال', '5123456711', 'approved', '09:00', '11:00'],
      ['الهام رحیمی', '0123456780', 'daily', d(15), d(17), reg(1), 'سفر کاری-خانوادگی', '5123456712', 'pending']
    ];

    return rows.map(function (r, i) {
      return {
        id: 'LR-1405-' + Utils.toEn(String(i + 1)).padStart(4, '0'),
        fullName: r[0],
        nationalId: r[1],
        leaveType: r[2],
        startDate: r[3],
        endDate: r[4],
        createdAt: r[5],
        reason: r[6],
        telegramId: r[7],
        status: r[8],
        startTime: r[9] || null,
        endTime: r[10] || null,
        decidedAt: r[8] === 'pending' ? null : r[5],
        decidedBy: r[8] === 'pending' ? null : 'مدیر سیستم'
      };
    });
  }

  var KEY = CONFIG.STORAGE_KEYS.requests;

  var MockStore = {
    load: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* ignore */ }
      var seed = buildSeed();
      MockStore.save(seed);
      return seed;
    },
    save: function (data) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage full / blocked */ }
    },
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      return MockStore.load();
    }
  };

  window.MockStore = MockStore;
})();
