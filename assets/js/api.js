/**
 * API Data Access Layer
 * ----------------------------------------------------------
 * All UI components interact with data through LeaveAPI.
 * When CONFIG.USE_MOCK = true, data is loaded from LocalStorage.
 * Otherwise, requests are sent to the Backend.
 *
 * Endpoint contract (proposed for the Backend):
 *   GET   /requests?search=&type=&status=&createdFrom=&createdTo=
 *   GET   /requests/:id
 *   PATCH /requests/:id/approve
 *   PATCH /requests/:id/reject
 *   GET   /reports/weekly?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Request object structure:
 *   { id, fullName, nationalId, leaveType: 'daily'|'hourly'|'sick',
 *     startDate, endDate, startTime?, endTime?, createdAt (Gregorian ISO),
 *     reason, telegramId, status: 'pending'|'approved'|'rejected' }
 */
(function () {
  'use strict';

  var delay = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  var mock = {
    _db: null,
    _data: function () {
      if (!mock._db) mock._db = MockStore.load();
      return mock._db;
    },

    getRequests: function () {
      return delay(120).then(function () {
        return mock._data().slice().sort(function (a, b) {
          return a.createdAt < b.createdAt ? 1 : (a.createdAt > b.createdAt ? -1 : (a.id < b.id ? 1 : -1));
        });
      });
    },

    getRequest: function (id) {
      return delay(60).then(function () {
        var item = mock._data().find(function (r) { return r.id === id; });
        if (!item) throw new Error('درخواست موردنظر یافت نشد.');
        return Object.assign({}, item);
      });
    },

    _decide: function (id, status) {
      return delay(200).then(function () {
        var item = mock._data().find(function (r) { return r.id === id; });
        if (!item) throw new Error('درخواست موردنظر یافت نشد.');
        if (item.status !== 'pending') throw new Error('وضعیت این درخواست قبلاً تعیین شده است.');
        item.status = status;
        item.decidedAt = Utils.todayISO();
        item.decidedBy = (Auth.currentUser() || {}).displayName || 'مدیر';
        MockStore.save(mock._data());
        return Object.assign({}, item);
      });
    },

    approveRequest: function (id) { return mock._decide(id, 'approved'); },
    rejectRequest: function (id) { return mock._decide(id, 'rejected'); },

    getWeeklyReport: function (params) {
      var range = Utils.weekRange(Utils.todayISO());
      var from = (params && params.from) || range.from;
      var to = (params && params.to) || range.to;
      var type = params && params.type;
      return delay(100).then(function () {
        return mock._data()
          .filter(function (r) {
            return r.status === 'approved' && r.startDate <= to && r.endDate >= from && (!type || r.leaveType === type);
          })
          .sort(function (a, b) { return a.startDate < b.startDate ? -1 : 1; })
          .map(function (r) { return Object.assign({}, r); });
      });
    }
  };

  function http(path, options) {
    var token = (Auth.currentUser() || {}).token;
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch(CONFIG.API_BASE_URL + path, Object.assign({ headers: headers }, options || {}))
      .then(function (res) {
        if (!res.ok) throw new Error('خطا در ارتباط با سرور (' + res.status + ')');
        return res.json();
      });
  }

  function qs(params) {
    var q = Object.keys(params || {})
      .filter(function (k) { return params[k]; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
    return q ? '?' + q : '';
  }

  var remote = {
    getRequests: function (params) { return http('/requests' + qs(params)); },
    getRequest: function (id) { return http('/requests/' + encodeURIComponent(id)); },
    approveRequest: function (id) { return http('/requests/' + encodeURIComponent(id) + '/approve', { method: 'PATCH' }); },
    rejectRequest: function (id) { return http('/requests/' + encodeURIComponent(id) + '/reject', { method: 'PATCH' }); },
    getWeeklyReport: function (params) { return http('/reports/weekly' + qs(params)); }
  };

  window.LeaveAPI = CONFIG.USE_MOCK ? mock : remote;
  window.LeaveAPI._mock = mock;     
})();
