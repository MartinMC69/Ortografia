// Poziomy trudności i ekran ustawień.
(function () {
  'use strict';
  var BP = window.BP;
  var ALL_CATS = ['ou', 'rzz', 'chh', 'nosowe', 'nie', 'wielka'];
  var ALL_TYPES = ['luka', 'wybor', 'wpisz', 'blad'];

  BP.LEVELS = {
    latwy: {
      id: 'latwy', nazwa: 'Łatwy', wiek: '8–10 lat', stawka: 10, maxPoziom: 1,
      opis: 'Wybór jednej z dwóch liter w krótkich, znanych słowach.',
      ustawienia: { liczbaZadan: 10, czasNaZadanie: null, zycia: 5, podpowiedzi: 'darmowe', kategorie: ['ou', 'rzz', 'chh'], rodzajeZadan: ['luka'] }
    },
    sredni: {
      id: 'sredni', nazwa: 'Średni', wiek: '10–12 lat', stawka: 15, maxPoziom: 2,
      opis: 'Luki w zdaniach i wybór poprawnego zapisu spośród trzech.',
      ustawienia: { liczbaZadan: 10, czasNaZadanie: 30, zycia: 3, podpowiedzi: 'platne', kategorie: ['ou', 'rzz', 'chh', 'nosowe'], rodzajeZadan: ['luka', 'wybor'] }
    },
    trudny: {
      id: 'trudny', nazwa: 'Trudny', wiek: '12–14 lat', stawka: 25, maxPoziom: 3,
      opis: 'Wpisywanie całych słów, szukanie błędów w zdaniach i wyjątki od zasad.',
      ustawienia: { liczbaZadan: 10, czasNaZadanie: 15, zycia: 3, podpowiedzi: 'wylaczone', kategorie: ALL_CATS.slice(), rodzajeZadan: ALL_TYPES.slice() }
    }
  };
  var LEVEL_IDS = ['latwy', 'sredni', 'trudny'];

  var OPTIONS = {
    liczbaZadan: [[5, '5 zadań'], [10, '10 zadań'], [15, '15 zadań'], [20, '20 zadań']],
    czasNaZadanie: [[null, 'Bez limitu'], [45, '45 sekund'], [30, '30 sekund'], [15, '15 sekund']],
    zycia: [[null, 'Bez limitu'], [5, '5 żyć'], [3, '3 życia'], [1, '1 życie']],
    podpowiedzi: [['darmowe', 'Za darmo'], ['platne', 'Kosztują 5 pkt'], ['wylaczone', 'Wyłączone']]
  };

  BP.levelSettings = function (id) {
    var s = BP.clone(BP.LEVELS[id].ustawienia);
    s.poziom = id;
    return s;
  };

  function allowed(field, v) {
    return OPTIONS[field].some(function (o) { return o[0] === v; });
  }
  BP.sanitizeSettings = function (d) {
    if (!d || !BP.LEVELS[d.poziom]) return BP.levelSettings('sredni');
    var s = BP.levelSettings(d.poziom);
    ['liczbaZadan', 'czasNaZadanie', 'zycia', 'podpowiedzi'].forEach(function (f) {
      if (allowed(f, d[f])) s[f] = d[f];
    });
    if (Array.isArray(d.kategorie)) {
      var k = ALL_CATS.filter(function (c) { return d.kategorie.indexOf(c) >= 0; });
      if (k.length) s.kategorie = k;
    }
    if (Array.isArray(d.rodzajeZadan)) {
      var r = ALL_TYPES.filter(function (t) { return d.rodzajeZadan.indexOf(t) >= 0; });
      if (r.length) s.rodzajeZadan = r;
    }
    return s;
  };

  BP.isModified = function (s) {
    var base = BP.LEVELS[s.poziom].ustawienia;
    return ['liczbaZadan', 'czasNaZadanie', 'zycia', 'podpowiedzi'].some(function (f) { return s[f] !== base[f]; }) ||
      s.kategorie.slice().sort().join() !== base.kategorie.slice().sort().join() ||
      s.rodzajeZadan.slice().sort().join() !== base.rodzajeZadan.slice().sort().join();
  };

  function levelSummary(l) {
    var u = l.ustawienia;
    var hint = { darmowe: 'podpowiedzi za darmo', platne: 'podpowiedź −5 pkt', wylaczone: 'bez podpowiedzi' }[u.podpowiedzi];
    return l.stawka + ' pkt za odpowiedź · ' + (u.czasNaZadanie ? u.czasNaZadanie + ' s na zadanie' : 'bez limitu czasu') + ' · ' +
      u.zycia + ' ' + BP.plural(u.zycia, 'życie', 'życia', 'żyć') + ' · ' + hint;
  }

  // ── Widok ────────────────────────────────────────────────
  var draft = null, saved = false;

  function select(field, label) {
    var cur = draft[field];
    return '<label class="select-field">' + label + '<select id="f-' + field + '" data-field="' + field + '">' +
      OPTIONS[field].map(function (o, i) {
        return '<option value="' + i + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>';
  }
  function checks(field, list) {
    return list.map(function (item) {
      return '<label class="check"><input type="checkbox" id="f-' + field + '-' + item.id + '" data-check="' + field + '" value="' + item.id + '"' +
        (draft[field].indexOf(item.id) >= 0 ? ' checked' : '') + '>' + item.nazwa + '</label>';
    }).join('');
  }

  BP.views.ustawienia = {
    render: function (root, entering) {
      if (entering || !draft) { draft = BP.clone(BP.state.ustawienia); saved = false; }
      var lvl = BP.LEVELS[draft.poziom], modified = BP.isModified(draft);
      var n = draft.liczbaZadan, invalid = !draft.kategorie.length || !draft.rodzajeZadan.length;

      var cards = LEVEL_IDS.map(function (id) {
        var l = BP.LEVELS[id], sel = id === draft.poziom;
        return '<label class="level-card' + (sel ? ' is-selected' : '') + '">' +
          '<span class="level-name-row"><input type="radio" name="poziom" id="f-poziom-' + id + '" value="' + id + '"' + (sel ? ' checked' : '') + '>' +
          '<span class="level-name">' + l.nazwa + '</span>' +
          (sel && modified ? '<span class="level-changed">zmieniony</span>' : '') +
          (sel ? '<span class="level-chip">Wybrany</span>' : '') + '</span>' +
          '<span class="muted">Polecany dla ' + l.wiek + '</span><span>' + l.opis + '</span>' +
          '<span style="font-weight:700">' + levelSummary(l) + '</span></label>';
      }).join('');

      root.innerHTML = BP.topbar('ustawienia') + '<main class="wrap page" style="gap:28px">' +
        '<div><h1 class="title-xl">Poziom trudności</h1><p class="lead">Wybierz gotowy poziom albo dopasuj rundę po swojemu.</p></div>' +
        '<fieldset class="auto-grid"><legend class="sr-only">Gotowe poziomy</legend>' + cards + '</fieldset>' +
        '<section class="card" style="padding:28px;gap:24px"><h2 style="font-size:1.75rem">Dopasuj rundę</h2>' +
          '<div class="auto-grid auto-grid--sm" style="gap:20px">' +
            select('liczbaZadan', 'Liczba zadań w rundzie') + select('czasNaZadanie', 'Czas na jedno zadanie') +
            select('zycia', 'Liczba żyć') + select('podpowiedzi', 'Podpowiedzi') + '</div>' +
          '<fieldset><legend>Zasady w rundzie</legend><div class="auto-grid auto-grid--sm">' + checks('kategorie', BP.CATEGORIES) + '</div></fieldset>' +
          '<fieldset><legend>Rodzaje zadań</legend><div class="auto-grid auto-grid--sm">' + checks('rodzajeZadan', BP.TASK_TYPES) + '</div></fieldset>' +
          '<div class="summary"><strong>Twoja runda: ' + n + ' ' + BP.plural(n, 'zadanie', 'zadania', 'zadań') + ', do zdobycia ' + n * lvl.stawka + ' pkt + premie za serie</strong>' +
          '<span style="font-weight:700">Gwiazdki: ' + Math.ceil(n * 0.5) + ' ' + BP.plural(Math.ceil(n * 0.5), 'poprawna', 'poprawne', 'poprawnych') + ' — jedna, ' + Math.ceil(n * 0.7 - 1e-9) + ' — dwie, ' + Math.ceil(n * 0.9 - 1e-9) + ' — trzy</span></div>' +
          '<p class="form-error" aria-live="polite">' + (invalid ? 'Zaznacz co najmniej jedną zasadę i co najmniej jeden rodzaj zadania, żeby zapisać ustawienia.' : '') + '</p>' +
        '</section>' +
        '<div aria-live="polite">' + (saved ? '<p class="toast">Zapisano ustawienia. Obowiązują od następnej rundy.</p>' : '') + '</div>' +
        '<div class="btn-row"><button type="button" class="btn btn--blue btn--lg" style="flex:1 1 240px" data-action="saveSettings"' + (invalid ? ' disabled' : '') + '>Zapisz ustawienia</button>' +
        '<button type="button" class="btn btn--ghost btn--lg" style="flex:0 1 300px" data-action="resetLevel">Przywróć poziom ' + lvl.nazwa + '</button></div>' +
        '</main>';
    },

    onChange: function (e) {
      var el = e.target, focusId = el.id;
      if (el.name === 'poziom') {
        draft = BP.levelSettings(el.value);
      } else if (el.dataset.field) {
        draft[el.dataset.field] = OPTIONS[el.dataset.field][parseInt(el.value, 10)][0];
      } else if (el.dataset.check) {
        var f = el.dataset.check, order = f === 'kategorie' ? ALL_CATS : ALL_TYPES;
        var set = draft[f].filter(function (x) { return x !== el.value; });
        if (el.checked) set.push(el.value);
        draft[f] = order.filter(function (x) { return set.indexOf(x) >= 0; });
      } else return;
      saved = false;
      BP.rerender();
      var again = document.getElementById(focusId);
      if (again) again.focus();
    }
  };

  BP.actions.saveSettings = function () {
    if (!draft.kategorie.length || !draft.rodzajeZadan.length) return;
    BP.state.ustawienia = BP.clone(draft);
    BP.save();
    saved = true;
    BP.rerender();
  };
  BP.actions.resetLevel = function () {
    draft = BP.levelSettings(draft.poziom);
    saved = false;
    BP.rerender();
  };
})();
