(function () {
  'use strict';

  var KEY = CONFIG.STORAGE_KEYS.session;

  window.Auth = {
    login: async function (username, password) {
      var response;

      try {
        response = await fetch(CONFIG.API_BASE_URL + '/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username: username, password: password })
        });
      } catch (error) {
        throw new Error('ارتباط با سرور برقرار نشد.');
      }

      var data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'ورود ناموفق بود.');
      }

      var user = {
        username: data.user.username,
        displayName: data.user.displayName,
        role: data.user.role,
        token: data.token,
        loggedInAt: Date.now()
      };

      sessionStorage.setItem(KEY, JSON.stringify(user));
      Auth._user = user;

      return user;
    },

    logout: function () {
      Auth._user = null;
      sessionStorage.removeItem(KEY);
    },

    currentUser: function () {
      if (Auth._user) return Auth._user;

      try {
        var raw = sessionStorage.getItem(KEY);
        if (raw) Auth._user = JSON.parse(raw);
      } catch (e) {
        sessionStorage.removeItem(KEY);
      }

      return Auth._user || null;
    },

    isLoggedIn: function () {
      return !!Auth.currentUser();
    },

    _user: null
  };
})();
