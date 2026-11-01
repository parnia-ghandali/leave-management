/**
 * احراز هویت نمایشی
 * ----------------------------------------------------------
 * هشدار: این ورود فقط یک شبیه‌سازی ظاهری است و هیچ امنیتی ندارد
 * (هر کسی می‌تواند sessionStorage را دستکاری کند). در نسخه واقعی،
 * احراز هویت باید توسط Backend انجام شود (مثلاً توکن JWT یا کوکی HttpOnly).
 */
(function () {
  'use strict';

  var KEY = CONFIG.STORAGE_KEYS.session;

  window.Auth = {
    login: function (username, password) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          var c = CONFIG.DEMO_CREDENTIALS;
          if (username === c.username && password === c.password) {
            var user = { username: c.username, displayName: c.displayName, loggedInAt: Date.now() };
            try { sessionStorage.setItem(KEY, JSON.stringify(user)); } catch (e) { /* ignore */ }
            Auth._user = user;
            resolve(user);
          } else {
            reject(new Error('نام کاربری یا رمز عبور اشتباه است.'));
          }
        }, 350);
      });
    },

    logout: function () {
      Auth._user = null;
      try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    },

    currentUser: function () {
      if (Auth._user) return Auth._user;
      try {
        var raw = sessionStorage.getItem(KEY);
        if (raw) Auth._user = JSON.parse(raw);
      } catch (e) { /* ignore */ }
      return Auth._user || null;
    },

    isLoggedIn: function () { return !!Auth.currentUser(); },
    _user: null
  };
})();
