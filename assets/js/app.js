/**
 * Dashboard UI Logic
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var esc = Utils.escapeHtml;
  var fa = Utils.toFa;

  var state = {
    view: 'dashboard',
    requests: [],
    page: 1,
    filters: { search: '', type: '', status: '', from: '', to: '' },
    weekly: { from: '', to: '', type: '' }
  };

  var TITLES = {
    dashboard: 'داشبورد',
    requests: 'درخواست‌های مرخصی',
    weekly: 'مرخصی‌های این هفته',
    reports: 'گزارش‌ها'
  };

  /* ------------------------------------------------------------------ *
   *Notifications (Toast)
   * ------------------------------------------------------------------ */
  function toast(message, type) {
    var el = document.createElement('div');
    el.className = 'toast toast--' + (type || 'success');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.textContent = message;
    $('#toasts').appendChild(el);
    setTimeout(function () {
      el.classList.add('is-leaving');
      setTimeout(function () { el.remove(); }, 250);
    }, 3800);
  }

  /* ------------------------------------------------------------------ *
   *Modal
   * ------------------------------------------------------------------ */
  var lastFocus = null;

  function openModal(opts) {
    lastFocus = document.activeElement;
    $('#modal-title').textContent = opts.title;
    $('#modal-body').innerHTML = opts.body;
    var foot = $('#modal-foot');
    foot.innerHTML = '';
    (opts.actions || []).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (a.className || 'btn--ghost');
      b.textContent = a.label;
      b.addEventListener('click', function () { a.onClick(b); });
      foot.appendChild(b);
    });
    $('#modal-root').hidden = false;
    document.body.classList.add('no-scroll');
    var first = $('#modal-foot .btn--primary, #modal-foot .btn--danger, #modal-foot .btn, #modal-close');
    if (first) first.focus();
  }

  function closeModal() {
    $('#modal-root').hidden = true;
    document.body.classList.remove('no-scroll');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ------------------------------------------------------------------ *
   *UI Components
   * ------------------------------------------------------------------ */
  function statusBadge(status) {
    return '<span class="badge badge--' + esc(status) + '">' + esc(LEAVE_STATUS[status] || status) + '</span>';
  }

  function typeLabel(type) { return esc(LEAVE_TYPES[type] || type); }

  function timeRange(r) {
    return r.leaveType === 'hourly' && r.startTime ? fa(r.startTime) + ' تا ' + fa(r.endTime) : '';
  }

  function emptyState(text) {
    return '<div class="empty"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h10M4 17h6"/></svg><p>' + esc(text) + '</p></div>';
  }

  function actionButtons(r) {
    var html = '<button class="btn btn--ghost btn--sm" data-act="view" data-id="' + esc(r.id) + '">جزئیات</button>';
    if (r.status === 'pending') {
      html += '<button class="btn btn--success btn--sm" data-act="approve" data-id="' + esc(r.id) + '">تأیید</button>' +
        '<button class="btn btn--danger-outline btn--sm" data-act="reject" data-id="' + esc(r.id) + '">رد</button>';
    }
    return '<div class="row-actions">' + html + '</div>';
  }

  /* ------------------------------------------------------------------ *
   *Data Loading
   * ------------------------------------------------------------------ */
  function loadRequests() {
    return LeaveAPI.getRequests().then(function (list) {
      state.requests = list;
      updateBadge();
    }).catch(function (err) {
      toast(err.message || 'دریافت اطلاعات با خطا مواجه شد.', 'error');
    });
  }

  function updateBadge() {
    var n = state.requests.filter(function (r) { return r.status === 'pending'; }).length;
    var b = $('#nav-pending-badge');
    b.textContent = fa(n);
    b.hidden = n === 0;
  }

  function refreshAll() {
    return loadRequests().then(function () {
      renderDashboard();
      renderRequests();
      renderReports();
      if (state.view === 'weekly') loadWeekly();
    });
  }

  /* ------------------------------------------------------------------ *
   *Dashboard
   * ------------------------------------------------------------------ */
  var STAT_ICONS = {
    total: '<path d="M9 4h6v2H9z"/><path d="M8 6H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2"/><path d="M8 12h8M8 16h5"/>',
    pending: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    approved: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 9.5"/>',
    rejected: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>'
  };

  function computeStats() {
    var s = { total: state.requests.length, pending: 0, approved: 0, rejected: 0 };
    state.requests.forEach(function (r) { s[r.status]++; });
    return s;
  }

  function renderDashboard() {
    var s = computeStats();
    var cards = [
      ['total', 'کل درخواست‌ها', s.total],
      ['pending', 'در انتظار بررسی', s.pending],
      ['approved', 'تأییدشده', s.approved],
      ['rejected', 'ردشده', s.rejected]
    ];
    $('#stats').innerHTML = cards.map(function (c) {
      return '<div class="stat stat--' + c[0] + '">' +
        '<div class="stat__icon"><svg viewBox="0 0 24 24">' + STAT_ICONS[c[0]] + '</svg></div>' +
        '<div><div class="stat__label">' + c[1] + '</div><div class="stat__value">' + fa(c[2]) + '</div></div>' +
        '</div>';
    }).join('');

    var pending = state.requests.filter(function (r) { return r.status === 'pending'; }).slice(0, 5);
    var box = $('#dashboard-pending');
    if (!pending.length) {
      box.innerHTML = emptyState('درخواست در انتظار بررسی وجود ندارد.');
      return;
    }
    box.innerHTML = '<div class="pending-list">' + pending.map(function (r) {
      return '<div class="pending-item">' +
        '<div class="pending-item__main">' +
        '<div class="pending-item__name">' + esc(r.fullName) + ' <span class="chip">' + typeLabel(r.leaveType) + '</span></div>' +
        '<div class="muted">از ' + Utils.formatJalali(r.startDate) + ' تا ' + Utils.formatJalali(r.endDate) +
        ' · ثبت: ' + Utils.formatJalali(r.createdAt) + '</div></div>' +
        actionButtons(r) + '</div>';
    }).join('') + '</div>';
  }

  /* ------------------------------------------------------------------ *
   *Requests Table (Search, Filters, Pagination)
   * ------------------------------------------------------------------ */
  function filteredRequests() {
    var f = state.filters;
    var q = Utils.normalizeText(f.search);
    return state.requests.filter(function (r) {
      if (q) {
        var hay = Utils.normalizeText(r.fullName + ' ' + r.nationalId + ' ' + r.id);
        if (hay.indexOf(q) === -1) return false;
      }
      if (f.type && r.leaveType !== f.type) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.from && r.createdAt < f.from) return false;
      if (f.to && r.createdAt > f.to) return false;
      return true;
    });
  }

  function renderRequests() {
    var list = filteredRequests();
    var size = CONFIG.PAGE_SIZE;
    var pages = Math.max(1, Math.ceil(list.length / size));
    if (state.page > pages) state.page = pages;
    var slice = list.slice((state.page - 1) * size, state.page * size);

    $('#result-count').textContent = fa(list.length) + ' درخواست از ' + fa(state.requests.length) + ' درخواست';

    var body = $('#requests-body');
    if (!slice.length) {
      body.innerHTML = '<tr class="no-card"><td colspan="9">' + emptyState('درخواستی با این مشخصات پیدا نشد.') + '</td></tr>';
    } else {
      body.innerHTML = slice.map(function (r) {
        return '<tr>' +
          '<td data-label="شناسه"><span class="mono">' + fa(r.id) + '</span></td>' +
          '<td data-label="نام و نام خانوادگی"><strong>' + esc(r.fullName) + '</strong></td>' +
          '<td data-label="کد ملی"><span class="mono">' + fa(r.nationalId) + '</span></td>' +
          '<td data-label="نوع مرخصی">' + typeLabel(r.leaveType) + '</td>' +
          '<td data-label="تاریخ شروع">' + Utils.formatJalali(r.startDate) + '</td>' +
          '<td data-label="تاریخ پایان">' + Utils.formatJalali(r.endDate) + '</td>' +
          '<td data-label="تاریخ ثبت">' + Utils.formatJalali(r.createdAt) + '</td>' +
          '<td data-label="وضعیت">' + statusBadge(r.status) + '</td>' +
          '<td data-label="عملیات">' + actionButtons(r) + '</td>' +
          '</tr>';
      }).join('');
    }

    var pg = $('#pagination');
    if (pages <= 1) { pg.innerHTML = ''; return; }
    var html = '<button class="btn btn--ghost btn--sm" data-page="' + (state.page - 1) + '"' + (state.page === 1 ? ' disabled' : '') + '>قبلی</button>';
    for (var i = 1; i <= pages; i++) {
      html += '<button class="page-btn' + (i === state.page ? ' is-active' : '') + '" data-page="' + i + '">' + fa(i) + '</button>';
    }
    html += '<button class="btn btn--ghost btn--sm" data-page="' + (state.page + 1) + '"' + (state.page === pages ? ' disabled' : '') + '>بعدی</button>';
    pg.innerHTML = html;
  }

  function readDateField(input, label) {
    var iso = Utils.parseJalaliInput(input.value);
    if (iso === null) {
      input.classList.add('is-invalid');
      toast('قالب ' + label + ' نامعتبر است. نمونه صحیح: ' + fa('1405/08/10'), 'error');
      return null;
    }
    input.classList.remove('is-invalid');
    return iso;
  }

  function applyFilters() {
    var from = readDateField($('#f-from'), 'تاریخ شروع بازه ثبت');
    var to = readDateField($('#f-to'), 'تاریخ پایان بازه ثبت');
    if (from === null || to === null) return;
    if (from && to && from > to) {
      toast('تاریخ شروع بازه نمی‌تواند بعد از تاریخ پایان باشد.', 'error');
      return;
    }
    state.filters = {
      search: $('#f-search').value,
      type: $('#f-type').value,
      status: $('#f-status').value,
      from: from,
      to: to
    };
    state.page = 1;
    renderRequests();
  }

  function resetFilters() {
    ['#f-search', '#f-from', '#f-to'].forEach(function (s) { $(s).value = ''; $(s).classList.remove('is-invalid'); });
    $('#f-type').value = '';
    $('#f-status').value = '';
    applyFilters();
  }

  /* ------------------------------------------------------------------ *
   *Request Details and Approval/Rejection
   * ------------------------------------------------------------------ */
  function detailRow(label, value) {
    return '<div class="detail"><dt>' + label + '</dt><dd>' + value + '</dd></div>';
  }

  function showDetails(id) {
    LeaveAPI.getRequest(id).then(function (r) {
      var rows =
        detailRow('شناسه درخواست', '<span class="mono">' + fa(r.id) + '</span>') +
        detailRow('وضعیت فعلی', statusBadge(r.status)) +
        detailRow('نام و نام خانوادگی', esc(r.fullName)) +
        detailRow('کد ملی', '<span class="mono">' + fa(r.nationalId) + '</span>') +
        detailRow('شناسه تلگرام', '<span class="mono">' + fa(r.telegramId) + '</span>') +
        detailRow('نوع مرخصی', typeLabel(r.leaveType)) +
        detailRow('تاریخ شروع', Utils.formatJalali(r.startDate)) +
        detailRow('تاریخ پایان', Utils.formatJalali(r.endDate)) +
        (timeRange(r) ? detailRow('بازه ساعتی', timeRange(r)) : '') +
        detailRow('تاریخ ثبت درخواست', Utils.formatJalali(r.createdAt)) +
        '<div class="detail detail--full"><dt>دلیل درخواست مرخصی</dt><dd class="reason">' + esc(r.reason) + '</dd></div>' +
        (r.decidedAt ? detailRow('تعیین تکلیف', Utils.formatJalali(r.decidedAt) + (r.decidedBy ? ' · ' + esc(r.decidedBy) : '')) : '');

      var actions = [{ label: 'بستن', className: 'btn--ghost', onClick: closeModal }];
      if (r.status === 'pending') {
        actions.unshift(
          { label: 'رد درخواست', className: 'btn--danger-outline', onClick: function () { confirmDecision(r, 'reject'); } },
          { label: 'تأیید درخواست', className: 'btn--success', onClick: function () { confirmDecision(r, 'approve'); } }
        );
      }
      openModal({ title: 'جزئیات درخواست مرخصی', body: '<dl class="details">' + rows + '</dl>', actions: actions });
    }).catch(function (err) { toast(err.message, 'error'); });
  }

  function confirmDecision(r, kind) {
    var approve = kind === 'approve';
    var body = '<p class="confirm-text">آیا از <strong>' + (approve ? 'تأیید' : 'رد') + '</strong> درخواست مرخصی <strong>' +
      typeLabel(r.leaveType) + '</strong> «' + esc(r.fullName) + '» از <strong>' + Utils.formatJalali(r.startDate) +
      '</strong> تا <strong>' + Utils.formatJalali(r.endDate) + '</strong> مطمئن هستید؟</p>' +
      '<p class="muted">پس از تعیین تکلیف، امکان تغییر وضعیت در این نسخه وجود ندارد.</p>';

    openModal({
      title: approve ? 'تأیید درخواست' : 'رد درخواست',
      body: body,
      actions: [
        {
          label: approve ? 'بله، تأیید شود' : 'بله، رد شود',
          className: approve ? 'btn--success' : 'btn--danger',
          onClick: function (btn) {
            btn.disabled = true;
            btn.textContent = 'در حال ثبت...';
            var call = approve ? LeaveAPI.approveRequest(r.id) : LeaveAPI.rejectRequest(r.id);
            call.then(function () {
              closeModal();
              toast('درخواست ' + r.fullName + (approve ? ' تأیید شد.' : ' رد شد.'), 'success');
              return refreshAll();
            }).catch(function (err) {
              closeModal();
              toast(err.message || 'ثبت تغییر با خطا مواجه شد.', 'error');
              refreshAll();
            });
          }
        },
        { label: 'انصراف', className: 'btn--ghost', onClick: closeModal }
      ]
    });
  }

  /* ------------------------------------------------------------------ *
   *Weekly Leave
   * ------------------------------------------------------------------ */
  function resetWeekly() {
    var w = Utils.weekRange(Utils.todayISO());
    state.weekly = { from: w.from, to: w.to, type: '' };
    $('#w-from').value = Utils.formatJalali(w.from);
    $('#w-to').value = Utils.formatJalali(w.to);
    $('#w-type').value = '';
    loadWeekly();
  }

  function applyWeekly() {
    var from = readDateField($('#w-from'), 'تاریخ شروع');
    var to = readDateField($('#w-to'), 'تاریخ پایان');
    if (from === null || to === null) return;
    if (!from || !to) { toast('هر دو تاریخ شروع و پایان الزامی است.', 'error'); return; }
    if (from > to) { toast('تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.', 'error'); return; }
    state.weekly = { from: from, to: to, type: $('#w-type').value };
    loadWeekly();
  }

  function loadWeekly() {
    var w = state.weekly;
    if (!w.from) {
      var cur = Utils.weekRange(Utils.todayISO());
      w = state.weekly = { from: cur.from, to: cur.to, type: '' };
      $('#w-from').value = Utils.formatJalali(cur.from);
      $('#w-to').value = Utils.formatJalali(cur.to);
    }
    $('#week-range').textContent = 'بازه نمایش: ' + Utils.formatJalali(w.from) + ' تا ' + Utils.formatJalali(w.to) +
      ' (فقط درخواست‌های تأییدشده)';

    LeaveAPI.getWeeklyReport(w).then(function (rows) {
      var body = $('#weekly-body');
      if (!rows.length) {
        body.innerHTML = '<tr class="no-card"><td colspan="4">' + emptyState('در این بازه مرخصی تأییدشده‌ای وجود ندارد.') + '</td></tr>';
        return;
      }
      body.innerHTML = rows.map(function (r) {
        return '<tr>' +
          '<td data-label="نام و نام خانوادگی"><strong>' + esc(r.fullName) + '</strong></td>' +
          '<td data-label="نوع مرخصی">' + typeLabel(r.leaveType) + (timeRange(r) ? ' <span class="muted">(' + timeRange(r) + ')</span>' : '') + '</td>' +
          '<td data-label="تاریخ شروع">' + Utils.formatJalali(r.startDate) + '</td>' +
          '<td data-label="تاریخ پایان">' + Utils.formatJalali(r.endDate) + '</td>' +
          '</tr>';
      }).join('');
    }).catch(function (err) { toast(err.message || 'دریافت گزارش با خطا مواجه شد.', 'error'); });
  }

  /* ------------------------------------------------------------------ *
   *Reports
   * ------------------------------------------------------------------ */
  function bars(items, total) {
    return '<div class="bars">' + items.map(function (it) {
      var pct = total ? Math.round(it.value * 100 / total) : 0;
      return '<div class="bar"><div class="bar__head"><span>' + it.label + '</span><span class="muted">' +
        fa(it.value) + ' (' + fa(pct) + '٪)</span></div>' +
        '<div class="bar__track"><div class="bar__fill bar__fill--' + it.key + '" style="width:' + pct + '%"></div></div></div>';
    }).join('') + '</div>';
  }

  function renderReports() {
    var total = state.requests.length;
    var s = computeStats();
    var types = Object.keys(LEAVE_TYPES).map(function (k) {
      return { key: k, label: LEAVE_TYPES[k], value: state.requests.filter(function (r) { return r.leaveType === k; }).length };
    });
    var statuses = Object.keys(LEAVE_STATUS).map(function (k) {
      return { key: k, label: LEAVE_STATUS[k], value: s[k] };
    });
    $('#report-types').innerHTML = bars(types.map(function (t) { t.key = 'type'; return t; }), total);
    $('#report-status').innerHTML = bars(statuses, total);

    var head = '<thead><tr><th>نوع مرخصی</th>' + Object.keys(LEAVE_STATUS).map(function (k) { return '<th>' + LEAVE_STATUS[k] + '</th>'; }).join('') + '<th>جمع</th></tr></thead>';
    var colTotals = { pending: 0, approved: 0, rejected: 0 };
    var body = '<tbody>' + Object.keys(LEAVE_TYPES).map(function (t) {
      var sum = 0;
      var cells = Object.keys(LEAVE_STATUS).map(function (st) {
        var n = state.requests.filter(function (r) { return r.leaveType === t && r.status === st; }).length;
        sum += n; colTotals[st] += n;
        return '<td>' + fa(n) + '</td>';
      }).join('');
      return '<tr><td><strong>' + LEAVE_TYPES[t] + '</strong></td>' + cells + '<td><strong>' + fa(sum) + '</strong></td></tr>';
    }).join('') + '</tbody>';
    var foot = '<tfoot><tr><td>جمع کل</td>' + Object.keys(LEAVE_STATUS).map(function (st) { return '<td>' + fa(colTotals[st]) + '</td>'; }).join('') + '<td>' + fa(total) + '</td></tr></tfoot>';
    $('#report-matrix').innerHTML = head + body + foot;
  }

  function exportCSV() {
    if (!state.requests.length) { toast('داده‌ای برای خروجی وجود ندارد.', 'error'); return; }
    var cols = ['شناسه درخواست', 'نام و نام خانوادگی', 'کد ملی', 'شناسه تلگرام', 'نوع مرخصی', 'تاریخ شروع', 'تاریخ پایان', 'تاریخ ثبت', 'وضعیت', 'دلیل'];
   // Prevent formula execution in Excel (CSV Injection)
    var safe = function (v) {
      var s = String(v == null ? '' : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    var lines = [cols.map(safe).join(',')];
    state.requests.forEach(function (r) {
      lines.push([r.id, r.fullName, r.nationalId, r.telegramId, LEAVE_TYPES[r.leaveType],
        Utils.formatJalali(r.startDate), Utils.formatJalali(r.endDate), Utils.formatJalali(r.createdAt),
        LEAVE_STATUS[r.status], r.reason].map(safe).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'leave-requests.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('فایل CSV آماده دانلود شد.', 'success');
  }

  /* ------------------------------------------------------------------ *
   *Navigation
   * ------------------------------------------------------------------ */
  function showView(name) {
    state.view = name;
    $$('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + name; });
    $$('.nav__item[data-view]').forEach(function (b) { b.classList.toggle('is-active', b.dataset.view === name); });
    $('#page-title').textContent = TITLES[name];
    closeSidebar();
    if (name === 'weekly') loadWeekly();
    window.scrollTo(0, 0);
  }

  function openSidebar() { $('#sidebar').classList.add('is-open'); $('#backdrop').hidden = false; }
  function closeSidebar() { $('#sidebar').classList.remove('is-open'); $('#backdrop').hidden = true; }

  /* ------------------------------------------------------------------ *
   *Authentication
   * ------------------------------------------------------------------ */
  function showLogin() {
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    $('#login-error').hidden = true;
    $('#password').value = '';
    $('#username').focus();
  }

  function showApp() {
    var user = Auth.currentUser();
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    $('#user-name').textContent = user.displayName;
    $('#user-avatar').textContent = user.displayName.charAt(0);
    $('#today-label').textContent = Utils.formatJalaliLong(Utils.todayISO());
    resetWeekly();
    refreshAll();
    showView('dashboard');
  }

  function onLogin(e) {
    e.preventDefault();
    var u = $('#username').value.trim();
    var p = $('#password').value;
    var err = $('#login-error');
    if (!u || !p) {
      err.textContent = 'نام کاربری و رمز عبور را وارد کنید.';
      err.hidden = false;
      return;
    }
    var btn = $('#login-form button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'در حال ورود...';
    Auth.login(u, p).then(function () {
      showApp();
      toast('خوش آمدید!', 'success');
    }).catch(function (ex) {
      err.textContent = ex.message;
      err.hidden = false;
    }).then(function () {
      btn.disabled = false;
      btn.textContent = 'ورود به سامانه';
    });
  }

  function onLogout() {
    openModal({
      title: 'خروج از حساب کاربری',
      body: '<p class="confirm-text">آیا مایل به خروج از سامانه هستید؟</p>',
      actions: [
        {
          label: 'خروج', className: 'btn--primary', onClick: function () {
            closeModal();
            Auth.logout();
            showLogin();
            toast('با موفقیت خارج شدید.', 'success');
          }
        },
        { label: 'انصراف', className: 'btn--ghost', onClick: closeModal }
      ]
    });
  }

  /* ------------------------------------------------------------------ *
   *Event Handlers
   * ------------------------------------------------------------------ */
  function bindEvents() {
    $('#login-form').addEventListener('submit', onLogin);
    $('#logout-btn').addEventListener('click', onLogout);

    $$('.nav__item[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { showView(b.dataset.view); });
    });
    document.addEventListener('click', function (e) {
      var go = e.target.closest('[data-goto]');
      if (go) { showView(go.dataset.goto); return; }

      var act = e.target.closest('[data-act]');
      if (act) {
        var id = act.dataset.id;
        if (act.dataset.act === 'view') { showDetails(id); return; }
        var r = state.requests.find(function (x) { return x.id === id; });
        if (r) confirmDecision(r, act.dataset.act);
        return;
      }

      var pg = e.target.closest('[data-page]');
      if (pg && !pg.disabled) {
        state.page = +pg.dataset.page;
        renderRequests();
        $('#requests-table').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    $('#menu-btn').addEventListener('click', openSidebar);
    $('#backdrop').addEventListener('click', closeSidebar);

    $('#modal-close').addEventListener('click', closeModal);
    $('#modal-root').addEventListener('mousedown', function (e) { if (e.target.id === 'modal-root') closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!$('#modal-root').hidden) closeModal(); else closeSidebar();
      }
      if (e.key === 'Tab' && !$('#modal-root').hidden) trapFocus(e);
    });

    var debounce;
    $('#f-search').addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(applyFilters, 200);
    });
    ['#f-type', '#f-status'].forEach(function (s) { $(s).addEventListener('change', applyFilters); });
    ['#f-from', '#f-to'].forEach(function (s) {
      $(s).addEventListener('change', applyFilters);
      $(s).addEventListener('keydown', function (e) { if (e.key === 'Enter') applyFilters(); });
    });
    $('#f-reset').addEventListener('click', resetFilters);

    $('#w-apply').addEventListener('click', applyWeekly);
    $('#w-reset').addEventListener('click', resetWeekly);
    $('#w-type').addEventListener('change', applyWeekly);

    $('#export-csv').addEventListener('click', exportCSV);
  }

  function trapFocus(e) {
    var items = $$('#modal button:not([disabled])');
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ------------------------------------------------------------------ *
   *Application Initialization
   * ------------------------------------------------------------------ */
  function init() {
    bindEvents();
    if (Auth.isLoggedIn()) showApp(); else showLogin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
