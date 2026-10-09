// Budowanie zadań ze słów i sprawdzanie odpowiedzi.
(function () {
  'use strict';
  var BP = window.BP;

  BP.TASK_TYPES = [
    { id: 'luka', nazwa: 'Uzupełnij lukę' },
    { id: 'wybor', nazwa: 'Wybierz poprawny zapis' },
    { id: 'wpisz', nazwa: 'Wpisz całe słowo' },
    { id: 'blad', nazwa: 'Znajdź błąd w zdaniu' }
  ];

  // Co dana opcja wstawia w lukę. Dla „nie” opcje to słowa razem / osobno.
  function fill(opt) {
    if (opt === 'razem') return '';
    if (opt === 'osobno') return ' ';
    return opt;
  }
  function supported(w) {
    var t = [];
    if (w.luka) t.push('luka');
    if (w.bledne && w.bledne.length >= 2) t.push('wybor');
    t.push('wpisz');
    if (w.bledne && w.bledne.length && w.zdanie.indexOf('___') >= 0) t.push('blad');
    return t;
  }
  function normalize(s) { return s.trim().replace(/\s+/g, ' '); }

  BP.tasks = {
    // Rodzaje włączone w ustawieniach i obsługiwane przez słowo. Gdy żaden się nie pokrywa
    // (np. przy powtórce błędów po zmianie ustawień), bierzemy dowolny obsługiwany.
    typesFor: function (w, enabled) {
      var s = supported(w);
      var both = s.filter(function (t) { return enabled.indexOf(t) >= 0; });
      return both.length ? both : s;
    },

    build: function (w, type) {
      var t = { word: w, type: type };
      if (type === 'luka') {
        t.options = w.luka.opcje.map(function (o) {
          return { label: o, given: w.luka.przed + fill(o) + w.luka.po, ok: o === w.luka.odpowiedz };
        });
      } else if (type === 'wybor') {
        t.options = BP.shuffle([w.slowo].concat(w.bledne.slice(0, 2))).map(function (o) {
          return { label: o, given: o, ok: o === w.slowo };
        });
      } else if (type === 'wpisz') {
        // W kategorii „wielka” pierwsza litera jest sednem zadania, więc jej nie podajemy.
        t.prefix = w.kategoria === 'wielka' ? '' : w.slowo.charAt(0);
      } else if (type === 'blad') {
        var bad = BP.pick(w.bledne);
        var parts = w.zdanie.split('___');
        var before = parts[0].trim() ? parts[0].trim().split(/\s+/) : [];
        var m = /^(\S*)([\s\S]*)$/.exec(parts[1] || '');
        var after = m[2].trim() ? m[2].trim().split(/\s+/) : [];
        t.bad = bad;
        t.badIndex = before.length;
        t.tokens = before.concat([bad + m[1]], after);
      }
      return t;
    },

    checkTyped: function (t, typed) {
      var a = normalize(t.prefix + typed), b = t.word.slowo;
      if (t.word.kategoria === 'wielka') return a === b;
      return a.toLocaleLowerCase('pl') === b.toLocaleLowerCase('pl');
    },

    // Zdanie z zaznaczonym słowem: przed odpowiedzią z luką albo pustym miejscem, po niej poprawne.
    sentence: function (t, answered) {
      var w = t.word, parts = w.zdanie.split('___'), mid;
      if (answered) mid = '<strong>' + BP.esc(w.slowo) + '</strong>';
      else if (t.type === 'luka') mid = '<strong>' + BP.esc(w.luka.przed) + '_' + BP.esc(w.luka.po) + '</strong>';
      else mid = '<span class="blank" aria-label="puste miejsce"></span>';
      return BP.esc(parts[0]) + mid + BP.esc(parts[1] || '');
    },

    title: function (t) {
      if (t.type === 'wybor') return 'Które słowo jest zapisane poprawnie?';
      if (t.type === 'wpisz') return 'Wpisz brakujące słowo';
      if (t.type === 'blad') return 'Znajdź błąd w zdaniu';
      var k = t.word.kategoria;
      if (k === 'nie') return 'Razem czy osobno?';
      if (k === 'wielka') return 'Wielka czy mała litera?';
      if (k === 'ou') return 'Wstaw brakującą literę';
      return 'Co pasuje w lukę?';
    }
  };
})();
