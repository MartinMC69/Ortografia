// Stan aplikacji, zapis do localStorage, routing po hashu, ekran startowy i historia.
(function () {
  'use strict';
  var BP = window.BP = window.BP || {};
  var STORE_KEY = 'bystrePioro.v1';
  var HISTORY_MAX = 50;

  BP.WORDS = window.BP_WORDS || [];

  BP.CATEGORIES = [
    { id: 'ou', nazwa: 'Ó czy U', znak: 'ó · u' },
    { id: 'rzz', nazwa: 'RZ czy Ż', znak: 'rz · ż' },
    { id: 'chh', nazwa: 'CH czy H', znak: 'ch · h' },
    { id: 'nosowe', nazwa: 'Ą, Ę, OM, EM', znak: 'ą · ę' },
    { id: 'nie', nazwa: 'NIE razem czy osobno', znak: 'nie' },
    { id: 'wielka', nazwa: 'Wielka i mała litera', znak: 'A · a' }
  ];
  BP.category = function (id) {
    return BP.CATEGORIES.filter(function (c) { return c.id === id; })[0];
  };

  // ── Pomocnicze ───────────────────────────────────────────
  BP.esc = function (t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  // Polska odmiana po liczebniku: 1 punkt, 2 punkty, 5 punktów.
  BP.plural = function (n, one, few, many) {
    if (n === 1) return one;
    var d = n % 10, t = n % 100;
    return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
  };
  BP.shuffle = function (list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), x = a[i];
      a[i] = a[j]; a[j] = x;
    }
    return a;
  };
  BP.pick = function (list) { return list[Math.floor(Math.random() * list.length)]; };
  BP.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  BP.dayKey = function (d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  BP.localStamp = function (d) {
    d = d || new Date();
    return BP.dayKey(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  };

  var STAR = '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"></polygon>';
  var HEART = '<path d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z"></path>';
  BP.icons = {
    logo: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2A52D6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.6 7.6"></path><circle cx="11" cy="11" r="2"></circle></svg>',
    star: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B2440" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + STAR + '</svg>',
    starBig: function (filled, size) {
      return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (filled ? '#FFB14A' : 'none') + '" stroke="' + (filled ? '#FFB14A' : 'currentColor') + '" stroke-width="2" stroke-linejoin="round" aria-hidden="true">' + STAR + '</svg>';
    },
    heart: function (full) {
      return '<svg width="26" height="26" viewBox="0 0 24 24" fill="' + (full ? '#C7361F' : 'none') + '" stroke="' + (full ? '#C7361F' : '#7C869E') + '" stroke-width="2" stroke-linejoin="round" aria-hidden="true">' + HEART + '</svg>';
    },
    timer: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2M9 2h6"></path></svg>',
    close: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B2440" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>',
    bulb: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B2440" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"></path></svg>',
    check: function (color, size) {
      return '<svg width="' + (size || 32) + '" height="' + (size || 32) + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"></path></svg>';
    },
    cross: function (color, size) {
      return '<svg width="' + (size || 26) + '" height="' + (size || 26) + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>';
    }
  };

  // ── Stan ─────────────────────────────────────────────────
  function defaultState() {
    return {
      profil: { imie: '', punkty: 0, seriaDni: 0, ostatniDzien: null },
      ustawienia: BP.levelSettings('sredni'),
      slowa: {},
      historia: []
    };
  }
  function load() {
    var s = defaultState(), d = null;
    try { d = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') return s;
    if (d.profil) {
      if (typeof d.profil.imie === 'string') s.profil.imie = d.profil.imie.slice(0, 20);
      if (d.profil.punkty >= 0) s.profil.punkty = Math.floor(d.profil.punkty);
      if (d.profil.seriaDni >= 0) s.profil.seriaDni = Math.floor(d.profil.seriaDni);
      if (typeof d.profil.ostatniDzien === 'string') s.profil.ostatniDzien = d.profil.ostatniDzien;
    }
    s.ustawienia = BP.sanitizeSettings(d.ustawienia);
    if (d.slowa && typeof d.slowa === 'object') s.slowa = d.slowa;
    if (Array.isArray(d.historia)) s.historia = d.historia.slice(0, HISTORY_MAX);
    return s;
  }
  BP.save = function () {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(BP.state)); } catch (e) { /* stan zostaje w pamięci */ }
  };
  BP.HISTORY_MAX = HISTORY_MAX;

  BP.isMastered = function (id) {
    var w = BP.state.slowa[id];
    return !!w && w.poprawneZRzedu >= 2;
  };
  // Seria liczy się tylko, jeśli ostatnia runda była dziś albo wczoraj.
  BP.currentStreak = function () {
    var p = BP.state.profil, y = new Date();
    if (!p.ostatniDzien) return 0;
    y.setDate(y.getDate() - 1);
    return p.ostatniDzien === BP.dayKey() || p.ostatniDzien === BP.dayKey(y) ? p.seriaDni : 0;
  };

  // ── Routing i zdarzenia ──────────────────────────────────
  BP.views = {};
  BP.actions = {};
  BP.forms = {};
  var app, currentRoute = null;

  BP.go = function (route) {
    if (location.hash === '#' + route) render(); else location.hash = route;
  };
  function render() {
    var route = location.hash.replace('#', '') || 'start';
    if (!BP.views[route]) route = 'start';
    if (route !== 'runda' && BP.game) BP.game.leave();
    var entering = route !== currentRoute;
    currentRoute = route;
    BP.views[route].render(app, entering);
    if (entering) window.scrollTo(0, 0);
    var focusEl = app.querySelector('[data-autofocus]');
    if (focusEl) focusEl.focus();
  }
  BP.rerender = function () { BP.views[currentRoute].render(app, false); };
  BP.route = function () { return currentRoute; };

  BP.topbar = function (active) {
    var p = BP.state.profil;
    function link(id, label) {
      return '<a href="#' + id + '"' + (active === id ? ' aria-current="page"' : '') + '>' + label + '</a>';
    }
    return '<header class="topbar"><div class="wrap topbar-in">' +
      '<a class="brand" href="#start">' + BP.icons.logo + 'Bystre Pióro</a>' +
      '<nav class="nav" aria-label="Główna">' + link('start', 'Start') + link('historia', 'Moje wyniki') + link('ustawienia', 'Ustawienia') + '</nav>' +
      (p.imie ? '<div class="topbar-end"><div class="pill pill--orange">' + BP.icons.star + p.punkty + ' pkt</div>' +
        '<button type="button" class="avatar" data-action="rename" aria-label="Profil: ' + BP.esc(p.imie) + '. Zmień imię" title="Zmień imię">' + BP.esc(p.imie.charAt(0).toUpperCase()) + '</button></div>' : '') +
      '</div></header>';
  };

  // ── Start ────────────────────────────────────────────────
  var renaming = false;
  BP.notice = '';

  function nameView() {
    var p = BP.state.profil;
    return BP.topbar('start') + '<main class="wrap page"><form class="name-card" data-form="name">' +
      '<h1 class="title-xl">' + (p.imie ? 'Zmień imię' : 'Cześć! Jak masz na imię?') + '</h1>' +
      '<label class="muted" for="imie">Wpisz swoje imię. Będziemy go używać w powitaniach i wynikach.</label>' +
      '<input class="name-input" id="imie" name="imie" maxlength="20" autocomplete="off" value="' + BP.esc(p.imie) + '" required data-autofocus>' +
      '<p class="form-error" id="name-error" aria-live="polite"></p>' +
      '<div class="btn-row"><button type="submit" class="btn btn--orange">' + (p.imie ? 'Zapisz' : 'Dalej') + '</button>' +
      (p.imie ? '<button type="button" class="btn btn--ghost" data-action="cancelRename">Anuluj</button>' : '') + '</div>' +
      '</form></main>';
  }

  function categoryCard(c, i) {
    var all = BP.WORDS.filter(function (w) { return w.kategoria === c.id; });
    var done = all.filter(function (w) { return BP.isMastered(w.id); }).length;
    var pct = all.length ? Math.round(done / all.length * 100) : 0;
    return '<article class="cat-card"><div class="cat-head">' +
      '<div class="cat-badge' + (i % 2 ? ' cat-badge--orange' : '') + '" aria-hidden="true">' + c.znak + '</div>' +
      '<div><h3>' + c.nazwa + '</h3><div class="muted">' + done + ' z ' + all.length + ' słów opanowanych</div></div></div>' +
      '<div class="bar" role="progressbar" aria-label="Opanowane słowa: ' + c.nazwa + '" aria-valuemin="0" aria-valuemax="' + all.length + '" aria-valuenow="' + done + '"><span style="width:' + pct + '%"></span></div>' +
      '<button type="button" class="btn btn--outline btn--small" data-action="practice" data-cat="' + c.id + '">Ćwicz<span class="sr-only">: ' + c.nazwa + '</span></button>' +
      '</article>';
  }

  BP.views.start = {
    render: function (root) {
      var s = BP.state, p = s.profil, u = s.ustawienia;
      if (!p.imie || renaming) { root.innerHTML = nameView(); return; }
      var level = BP.LEVELS[u.poziom], last = s.historia[0], streak = BP.currentStreak();
      var n = u.liczbaZadan;
      root.innerHTML = BP.topbar('start') + '<main class="wrap page">' +
        '<section class="row" aria-label="Dzisiejsza runda">' +
          '<div class="hero" style="flex:2 1 420px">' +
            '<div class="eyebrow">Dzisiejsza runda</div>' +
            '<h1 class="hero-title">Cześć, ' + BP.esc(p.imie) + '! Ćwiczymy dziś ' + n + ' ' + BP.plural(n, 'słowo', 'słowa', 'słów') + '?</h1>' +
            '<p style="font-size:1.125rem;max-width:34rem">Za każdą poprawną odpowiedź zdobywasz punkty. Trzy dobre odpowiedzi z rzędu dają dodatkową premię.</p>' +
            (BP.notice ? '<p class="notice" role="status" style="color:var(--ink)">' + BP.esc(BP.notice) + '</p>' : '') +
            '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:16px;margin-top:8px">' +
              '<button type="button" class="btn btn--orange" data-action="startRound">Zacznij rundę</button>' +
              '<div style="font-weight:700">Poziom: ' + level.nazwa + (BP.isModified(u) ? ' (zmieniony)' : '') + ' · <a href="#ustawienia">zmień</a></div>' +
            '</div>' +
          '</div>' +
          '<div style="flex:1 1 260px;display:flex;flex-direction:column;gap:16px">' +
            '<div class="stat"><div class="stat-label">Punkty razem</div><div class="stat-value">' + p.punkty + '</div></div>' +
            '<div class="stat"><div class="stat-label">Seria dni z nauką</div><div class="stat-value">' + streak + ' ' + (streak === 1 ? 'dzień' : 'dni') + '</div></div>' +
            '<div class="stat"><div class="stat-label">Ostatni wynik</div><div class="stat-value">' + (last ? last.poprawne + ' z ' + last.zadania : '–') + '</div></div>' +
          '</div>' +
        '</section>' +
        '<section style="display:flex;flex-direction:column;gap:16px">' +
          '<h2 class="head" style="font-size:1.875rem">Wybierz, co chcesz ćwiczyć</h2>' +
          '<div class="auto-grid">' + BP.CATEGORIES.map(categoryCard).join('') + '</div>' +
        '</section></main>';
      BP.notice = '';
    }
  };

  BP.forms.name = function (form) {
    var v = form.imie.value.trim().slice(0, 20);
    if (!v) {
      document.getElementById('name-error').textContent = 'Wpisz imię, żeby przejść dalej.';
      form.imie.focus();
      return;
    }
    BP.state.profil.imie = v;
    BP.save();
    renaming = false;
    BP.go('start');
  };
  BP.actions.rename = function () { renaming = true; BP.go('start'); };
  BP.actions.cancelRename = function () { renaming = false; BP.go('start'); };
  BP.actions.startRound = function () { BP.game.start({}); };
  BP.actions.practice = function (el) { BP.game.start({ kategoria: el.dataset.cat }); };

  // ── Moje wyniki ──────────────────────────────────────────
  var MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  function formatDate(stamp) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(stamp || '');
    if (!m) return '';
    return parseInt(m[3], 10) + ' ' + MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1] + ', ' + m[4] + ':' + m[5];
  }
  BP.views.historia = {
    render: function (root) {
      if (!BP.state.profil.imie) { BP.go('start'); return; }
      var list = BP.state.historia.slice(0, 10);
      var items = list.map(function (h) {
        var lvl = BP.LEVELS[h.poziom];
        var stars = '';
        for (var i = 0; i < 3; i++) stars += BP.icons.starBig(i < h.gwiazdki, 24);
        return '<li><div><div class="history-score">' + h.poprawne + ' z ' + h.zadania + ' poprawnych</div>' +
          '<div class="muted">' + formatDate(h.data) + (lvl ? ' · poziom ' + lvl.nazwa : '') + '</div></div>' +
          '<div style="display:flex;align-items:center;gap:16px"><span class="stars" style="margin:0;color:var(--line-strong)" role="img" aria-label="' + h.gwiazdki + ' ' + BP.plural(h.gwiazdki, 'gwiazdka', 'gwiazdki', 'gwiazdek') + ' z 3">' + stars + '</span>' +
          '<strong style="font-size:1.25rem">+' + h.punkty + ' pkt</strong></div></li>';
      }).join('');
      root.innerHTML = BP.topbar('historia') + '<main class="wrap page page--tight">' +
        '<div><h1 class="title-xl">Moje wyniki</h1><p class="lead">Ostatnie rundy, od najnowszej.</p></div>' +
        (items ? '<ol class="history">' + items + '</ol>' :
          '<div class="card"><p style="font-size:1.125rem">Nie masz jeszcze żadnej ukończonej rundy. Zagraj pierwszą!</p>' +
          '<div><button type="button" class="btn btn--orange" data-action="startRound">Zacznij rundę</button></div></div>') +
        '</main>';
    }
  };

  // ── Start aplikacji ──────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    app = document.getElementById('app');
    BP.state = load();
    app.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (el && !el.disabled && BP.actions[el.dataset.action]) BP.actions[el.dataset.action](el, e);
    });
    app.addEventListener('submit', function (e) {
      var form = e.target.closest('[data-form]');
      if (!form) return;
      e.preventDefault();
      if (BP.forms[form.dataset.form]) BP.forms[form.dataset.form](form);
    });
    app.addEventListener('change', function (e) {
      var v = BP.views[currentRoute];
      if (v && v.onChange) v.onChange(e);
    });
    document.addEventListener('keydown', function (e) {
      var v = BP.views[currentRoute];
      if (v && v.onKey) v.onKey(e);
    });
    window.addEventListener('hashchange', render);
    render();
  });
})();
