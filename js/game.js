// Przebieg rundy, punktacja i ekran wyników.
(function () {
  'use strict';
  var BP = window.BP;
  var STREAK_BONUS = 5, HINT_COST = 5;
  var R = null;          // bieżąca runda
  var timerId = null;

  // ── Start i koniec ───────────────────────────────────────
  function buildRound(opts) {
    var s = BP.state, u = s.ustawienia, level = BP.LEVELS[u.poziom];
    var pool, n;
    if (opts.slowa) {
      pool = BP.WORDS.filter(function (w) { return opts.slowa.indexOf(w.id) >= 0; });
      n = pool.length;
    } else {
      var cats = opts.kategoria ? [opts.kategoria] : u.kategorie;
      pool = BP.WORDS.filter(function (w) { return cats.indexOf(w.kategoria) >= 0 && w.poziom <= level.maxPoziom; });
      n = u.liczbaZadan;
    }
    // Słowa do powtórki mają pierwszeństwo, ale zajmują najwyżej połowę rundy.
    var review = BP.shuffle(pool.filter(function (w) { return s.slowa[w.id] && s.slowa[w.id].doPowtorki; }));
    review = opts.slowa ? review : review.slice(0, Math.floor(n / 2));
    var rest = BP.shuffle(pool.filter(function (w) { return review.indexOf(w) < 0; })).slice(0, n - review.length);
    var tasks = BP.shuffle(review.concat(rest)).map(function (w) {
      return BP.tasks.build(w, BP.pick(BP.tasks.typesFor(w, u.rodzajeZadan)));
    });
    return {
      opts: opts,
      tasks: tasks,
      i: 0,
      poziom: u.poziom,
      stawka: level.stawka,
      czas: u.czasNaZadanie,
      zyciaMax: u.zycia,
      zycia: u.zycia,
      podpowiedzi: u.podpowiedzi,
      seria: 0,
      correct: 0,
      premie: 0,
      hintsUsed: 0,
      hintCost: 0,
      hintShown: false,
      answered: null,
      results: [],
      endedByLives: false
    };
  }

  function roundPoints() { return Math.max(0, R.correct * R.stawka + R.premie - R.hintCost); }

  function finish() {
    stopTimer();
    var s = BP.state, n = R.tasks.length, pct = R.correct / n;
    var stars = pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct >= 0.5 ? 1 : 0;
    var points = roundPoints();

    s.profil.punkty += points;
    var today = BP.dayKey(), y = new Date();
    y.setDate(y.getDate() - 1);
    if (s.profil.ostatniDzien !== today) {
      s.profil.seriaDni = s.profil.ostatniDzien === BP.dayKey(y) ? s.profil.seriaDni + 1 : 1;
      s.profil.ostatniDzien = today;
    }
    R.results.forEach(function (r) {
      var w = s.slowa[r.word.id] || { poprawneZRzedu: 0, doPowtorki: false };
      if (r.ok) { w.poprawneZRzedu += 1; w.doPowtorki = false; }
      else { w.poprawneZRzedu = 0; w.doPowtorki = true; }
      s.slowa[r.word.id] = w;
    });
    s.historia.unshift({ data: BP.localStamp(), poziom: R.poziom, poprawne: R.correct, zadania: n, punkty: points, gwiazdki: stars });
    s.historia = s.historia.slice(0, BP.HISTORY_MAX);
    BP.save();

    var byCat = [];
    BP.CATEGORIES.forEach(function (c) {
      var ts = R.tasks.filter(function (t) { return t.word.kategoria === c.id; });
      if (!ts.length) return;
      var ok = R.results.filter(function (r) { return r.ok && r.word.kategoria === c.id; }).length;
      byCat.push({ nazwa: c.nazwa, ok: ok, all: ts.length });
    });
    BP.lastResult = {
      opts: R.opts, poziom: R.poziom, n: n, correct: R.correct, stars: stars, points: points,
      total: s.profil.punkty, stawka: R.stawka, premie: R.premie, hintsUsed: R.hintsUsed, hintCost: R.hintCost,
      endedByLives: R.endedByLives, byCat: byCat,
      wrong: R.results.filter(function (r) { return !r.ok; })
    };
    R = null;
    BP.go('wyniki');
  }

  BP.game = {
    start: function (opts) {
      var round = buildRound(opts);
      if (!round.tasks.length) {
        BP.notice = 'Brak słów pasujących do ustawień. Zmień poziom albo zasady w ustawieniach.';
        BP.go('start');
        return;
      }
      R = round;
      BP.go('runda');
    },
    leave: function () { stopTimer(); R = null; },
    current: function () { return R; }   // do testów i debugowania
  };

  // ── Licznik czasu ────────────────────────────────────────
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function startTimer() {
    stopTimer();
    if (!R || R.czas === null) return;
    R.deadline = Date.now() + R.czas * 1000;
    timerId = setInterval(tick, 200);
    tick();
  }
  function tick() {
    if (!R || R.answered) { stopTimer(); return; }
    var left = Math.max(0, Math.ceil((R.deadline - Date.now()) / 1000));
    var el = document.getElementById('timer');
    if (el) {
      el.querySelector('span').textContent = '0:' + (left < 10 ? '0' : '') + left;
      el.classList.toggle('pill--alert', left <= 5);
    }
    if (left <= 0) answer({ ok: false, timeout: true, given: '' });
  }

  // ── Odpowiedzi ───────────────────────────────────────────
  function answer(a) {
    if (!R || R.answered) return;
    stopTimer();
    var t = R.tasks[R.i];
    a.bonus = 0;
    if (a.ok) {
      R.correct++;
      R.seria++;
      if (R.seria % 3 === 0) { a.bonus = STREAK_BONUS; R.premie += STREAK_BONUS; }
    } else {
      R.seria = 0;
      if (R.zycia !== null) R.zycia--;
    }
    R.answered = a;
    R.results.push({ word: t.word, ok: a.ok, given: a.given, timeout: !!a.timeout });
    if (R.zycia === 0) R.endedByLives = true;
    BP.rerender();
    var next = document.getElementById('next-btn');
    if (next) next.focus();
  }

  function next() {
    if (!R || !R.answered) return;
    if (R.endedByLives || R.i >= R.tasks.length - 1) { finish(); return; }
    R.i++;
    R.answered = null;
    R.hintShown = false;
    BP.rerender();
    var target = document.getElementById('slowo') || document.getElementById('task-title');
    if (target) target.focus();
    startTimer();
  }

  function chooseOption(index) {
    var t = R.tasks[R.i], o = t.options[index];
    if (!o) return;
    answer({ ok: o.ok, given: o.given, choice: index });
  }

  BP.actions.answer = function (el) { chooseOption(parseInt(el.dataset.i, 10)); };
  BP.actions.token = function (el) {
    var t = R.tasks[R.i], i = parseInt(el.dataset.i, 10);
    answer({ ok: i === t.badIndex, given: t.bad, choice: i });
  };
  BP.forms.wpisz = function (form) {
    if (!R || R.answered) return;
    var t = R.tasks[R.i], typed = form.slowo.value;
    if (!typed.trim()) {
      document.getElementById('type-error').textContent = 'Wpisz słowo, zanim sprawdzisz.';
      form.slowo.focus();
      return;
    }
    answer({ ok: BP.tasks.checkTyped(t, typed), given: (t.prefix + typed).trim(), typed: typed });
  };
  BP.actions.next = next;
  BP.actions.hint = function () {
    if (!R || R.answered || R.hintShown || R.podpowiedzi === 'wylaczone') return;
    R.hintShown = true;
    R.hintsUsed++;
    if (R.podpowiedzi === 'platne') R.hintCost += HINT_COST;
    BP.rerender();
    var h = document.getElementById('hint-text');
    if (h) h.focus();
  };
  BP.actions.quit = function () {
    if (window.confirm('Przerwać rundę? Punkty z tej rundy nie zostaną zapisane.')) BP.go('start');
  };

  // ── Widok rundy ──────────────────────────────────────────
  function roundHeader() {
    var n = R.tasks.length, done = R.i + (R.answered ? 1 : 0);
    var hearts = '';
    if (R.zyciaMax !== null) {
      for (var h = 0; h < R.zyciaMax; h++) hearts += BP.icons.heart(h < R.zycia);
      hearts = '<div class="hearts" role="img" aria-label="' + BP.plural(R.zycia, 'Zostało', 'Zostały', 'Zostało') + ' ' + R.zycia + ' ' + BP.plural(R.zycia, 'życie', 'życia', 'żyć') + ' z ' + R.zyciaMax + '">' + hearts + '</div>';
    }
    var left = R.answered || !R.deadline ? R.czas : Math.max(0, Math.ceil((R.deadline - Date.now()) / 1000));
    return '<header class="topbar"><div class="wrap wrap--narrow topbar-in topbar-in--round">' +
      '<button type="button" class="icon-btn" data-action="quit" aria-label="Zakończ rundę">' + BP.icons.close + '</button>' +
      '<div class="round-progress"><div style="font-weight:800">Zadanie ' + (R.i + 1) + ' z ' + n + '</div>' +
      '<div class="bar bar--round" role="progressbar" aria-label="Postęp rundy" aria-valuemin="0" aria-valuemax="' + n + '" aria-valuenow="' + done + '"><span style="width:' + (done / n * 100) + '%"></span></div></div>' +
      (R.czas !== null ? '<div class="pill pill--blue' + (!R.answered && left <= 5 ? ' pill--alert' : '') + '" id="timer" role="timer" aria-label="Pozostały czas">' + BP.icons.timer + '<span>0:' + (left < 10 ? '0' : '') + left + '</span></div>' : '') +
      '<div class="pill pill--orange" aria-label="Punkty w tej rundzie">' + BP.icons.star + roundPoints() + ' pkt</div>' +
      hearts + '</div></header>';
  }

  function stateClass(isRight, isChosen) {
    if (isRight) return ' is-correct';
    if (isChosen) return ' is-wrong';
    return ' is-dim';
  }

  function taskCard(t) {
    var a = R.answered, w = t.word, html = '<section class="kratka task-card">';
    var title = BP.tasks.title(t);
    if (t.type === 'luka') {
      var gap;
      if (!a) gap = '<span class="gap' + (w.kategoria === 'nie' ? ' gap--narrow' : '') + '" role="img" aria-label="luka"></span>';
      else if (w.kategoria === 'nie') gap = '<span class="gap-fill">' + (w.luka.odpowiedz === 'osobno' ? '&nbsp;' : '') + '</span>';
      else gap = '<span class="gap-fill">' + BP.esc(w.luka.odpowiedz) + '</span>';
      html += '<h1 class="task-title" id="task-title" tabindex="-1">' + title + '</h1>' +
        '<div class="word-big"><span>' + BP.esc(w.luka.przed) + '</span>' + gap + '<span>' + BP.esc(w.luka.po) + '</span></div>' +
        '<p class="task-sentence">' + BP.tasks.sentence(t, !!a) + '</p>';
    } else if (t.type === 'wybor') {
      html += '<h1 class="task-title task-title--big" id="task-title" tabindex="-1">' + title + '</h1><p class="task-sentence">Kliknij właściwy zapis.</p>';
    } else if (t.type === 'wpisz') {
      html += '<h1 class="task-title task-title--big" id="task-title" tabindex="-1">' + title + '</h1>' +
        '<p class="task-sentence">' + BP.tasks.sentence(t, !!a) + '</p>';
    } else if (t.type === 'blad') {
      html += '<h1 class="task-title task-title--big" id="task-title" tabindex="-1">' + title + '</h1><p class="task-sentence">Jedno słowo w zdaniu poniżej jest zapisane niepoprawnie. Kliknij je.</p>';
    }
    return html + '</section>';
  }

  function answerArea(t) {
    var a = R.answered;
    if (t.type === 'luka' || t.type === 'wybor') {
      var isText = t.type === 'luka' && t.options.some(function (o) { return o.label.length > 2; });
      var cls = t.type === 'wybor' ? ' ans--word' : (isText ? ' ans--text' : '');
      return '<div role="group" aria-label="Odpowiedzi" class="answers' + (t.type === 'wybor' ? ' answers--words' : '') + '">' +
        t.options.map(function (o, i) {
          var st = a ? stateClass(o.ok, a.choice === i) : '';
          var icon = a && o.ok ? BP.icons.check('#FFFFFF') : (a && a.choice === i ? BP.icons.cross('#A1271A', 28) : '');
          var sr = a && o.ok ? '<span class="sr-only"> (poprawna odpowiedź)</span>' : (a && a.choice === i ? '<span class="sr-only"> (twoja odpowiedź, błędna)</span>' : '');
          return '<button type="button" class="ans' + cls + st + '" data-action="answer" data-i="' + i + '"' + (a ? ' disabled' : '') + '>' +
            (a ? '' : '<span class="key" aria-hidden="true">' + (i + 1) + '</span>') + icon + BP.esc(o.label) + sr + '</button>';
        }).join('') + '</div>';
    }
    if (t.type === 'blad') {
      return '<div role="group" aria-label="Słowa w zdaniu" class="tokens">' + t.tokens.map(function (tok, i) {
        var st = a ? stateClass(i === t.badIndex, a.choice === i) : '';
        var icon = a && i === t.badIndex ? BP.icons.check('#FFFFFF', 22) : (a && a.choice === i ? BP.icons.cross('#A1271A', 20) : '');
        return '<button type="button" class="tok' + st + '" data-action="token" data-i="' + i + '"' + (a ? ' disabled' : '') + '>' + icon + BP.esc(tok) + '</button>';
      }).join('') + '</div>';
    }
    // wpisz
    var label = t.prefix ? 'Słowo zaczyna się na „' + BP.esc(t.prefix) + '”. Dopisz resztę:' : 'Wpisz całe słowo. Uważaj na pierwszą literę!';
    return '<form class="type-form" data-form="wpisz" autocomplete="off">' +
      '<div class="type-field"><label for="slowo">' + label + '</label>' +
      '<div class="type-row">' + (t.prefix ? '<span aria-hidden="true">' + BP.esc(t.prefix) + '</span>' : '') +
      '<input class="type-input' + (a ? (a.ok ? ' is-correct' : ' is-wrong') : '') + '" id="slowo" name="slowo" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="30"' +
      (a ? ' readonly value="' + BP.esc(a.typed || '') + '"' : ' data-autofocus') + '></div></div>' +
      (a ? '' : '<button type="submit" class="btn btn--blue">Sprawdź</button>') +
      '<p class="form-error" id="type-error" aria-live="polite" style="flex-basis:100%;text-align:center"></p></form>';
  }

  function footer() {
    if (R.answered) return '';
    var s = R.seria, nextBonus = (s + 1) % 3 === 0;
    var serie = s ? 'Seria: ' + s + ' ' + BP.plural(s, 'poprawna', 'poprawne', 'poprawnych') + ' z rzędu' + (nextBonus ? ' · następna da premię +' + STREAK_BONUS + ' pkt' : '') : 'Trzy dobre odpowiedzi z rzędu dają premię +' + STREAK_BONUS + ' pkt';
    var hint = '';
    if (R.podpowiedzi !== 'wylaczone') {
      hint = '<button type="button" class="hint-btn" data-action="hint"' + (R.hintShown ? ' disabled' : '') + '>' + BP.icons.bulb +
        'Podpowiedź' + (R.podpowiedzi === 'platne' ? ' (−' + HINT_COST + ' pkt)' : ' (za darmo)') + '</button>';
    }
    return (R.hintShown ? '<p class="hint-text" id="hint-text" tabindex="-1">' + BP.icons.bulb + ' ' + BP.esc(R.tasks[R.i].word.podpowiedz) + '</p>' : '') +
      '<div class="task-foot">' + hint + '<div class="muted" style="margin-left:auto">' + serie + '</div></div>';
  }

  function panel(t) {
    var a = R.answered, w = t.word, last = R.endedByLives || R.i >= R.tasks.length - 1;
    var btn = '<button type="button" class="btn btn--blue" id="next-btn" data-action="next">' + (last ? 'Zobacz wynik' : 'Następne zadanie') + '</button>';
    var rule = '<p><strong>Zasada:</strong> ' + BP.esc(w.zasada) + '</p>';
    if (a.ok) {
      return '<section class="panel panel--ok" aria-live="polite"><div class="panel-body">' +
        '<div class="panel-title">' + BP.icons.check('#14633A', 30) + '<h2>Brawo, dobrze!</h2><span class="badge">+' + R.stawka + ' pkt</span>' +
        (a.bonus ? '<span class="badge">Premia za serię +' + a.bonus + ' pkt</span>' : '') + '</div>' + rule +
        '<div class="panel-meta">Seria: ' + R.seria + ' ' + BP.plural(R.seria, 'poprawna', 'poprawne', 'poprawnych') + ' z rzędu</div>' +
        '</div>' + btn + '</section>';
    }
    var lost = R.zyciaMax !== null ? 'tracisz 1 życie, 0 pkt' : '0 pkt';
    return '<section class="panel panel--bad" aria-live="polite"><div class="panel-body">' +
      '<div class="panel-title">' + BP.icons.cross('#A1271A') + '<h2>' + (a.timeout ? 'Czas minął' : 'Jeszcze nie tym razem') + '</h2></div>' +
      '<p class="panel-meta" style="color:var(--bad)">' + (a.timeout ? 'Zabrakło czasu – ' : 'Tym razem ') + lost + '.</p>' +
      '<p>Poprawny zapis to <strong>' + BP.esc(w.slowo) + '</strong>. Słowo trafia na listę do powtórki i wróci w kolejnej rundzie.</p>' + rule +
      (R.endedByLives ? '<p class="panel-meta">Skończyły się życia, więc to koniec rundy.</p>' : '') +
      '</div>' + btn + '</section>';
  }

  BP.views.runda = {
    render: function (root, entering) {
      if (!R) { BP.go('start'); return; }
      var t = R.tasks[R.i], lvl = BP.LEVELS[R.poziom];
      root.innerHTML = roundHeader() + '<main class="wrap wrap--narrow page page--tight">' +
        '<div class="tag-row"><span class="tag">' + BP.category(t.word.kategoria).nazwa + '</span>' +
        '<span class="muted">Poziom: ' + lvl.nazwa + ' · ' + R.stawka + ' pkt za poprawną odpowiedź</span></div>' +
        taskCard(t) + answerArea(t) + (R.answered ? panel(t) : footer()) + '</main>';
      if (entering) {
        var title = document.getElementById('task-title');
        if (title && t.type !== 'wpisz') title.focus();
        startTimer();
      }
    },
    onKey: function (e) {
      if (!R || e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = e.target.tagName;
      if (!R.answered && /^[1-9]$/.test(e.key) && tag !== 'INPUT') {
        var t = R.tasks[R.i];
        if (t.type === 'luka' || t.type === 'wybor') { e.preventDefault(); chooseOption(parseInt(e.key, 10) - 1); }
      } else if (R.answered && e.key === 'Enter' && tag !== 'BUTTON' && tag !== 'A') {
        e.preventDefault();
        next();
      }
    }
  };

  // ── Wyniki ───────────────────────────────────────────────
  var MESSAGES = ['Spróbuj jeszcze raz — będzie lepiej!', 'Dobry początek', 'Świetna robota', 'Mistrzowska runda'];
  var THRESHOLDS = [0.5, 0.7, 0.9];

  BP.views.wyniki = {
    render: function (root) {
      var r = BP.lastResult;
      if (!r) { BP.go('start'); return; }
      var name = BP.esc(BP.state.profil.imie), lvl = BP.LEVELS[r.poziom];
      var title = r.stars ? MESSAGES[r.stars] + ', ' + name + '!' : MESSAGES[0];
      var sub = 'Poprawne odpowiedzi: ' + r.correct + ' z ' + r.n + '.';
      if (r.endedByLives) sub += ' Skończyły się życia.';
      if (r.stars < 3) {
        var need = Math.ceil(THRESHOLDS[r.stars] * r.n - 1e-9) - r.correct;
        sub += ' Do ' + ['pierwszej', 'drugiej', 'trzeciej'][r.stars] + ' gwiazdki ' + (need === 1 ? 'zabrakło jednej poprawnej odpowiedzi.' : 'zabrakło ' + need + ' poprawnych odpowiedzi.');
      }
      var stars = '';
      for (var i = 0; i < 3; i++) stars += BP.icons.starBig(i < r.stars, 52);

      var rawSum = r.correct * r.stawka + r.premie - r.hintCost;
      var calc = '<div class="calc-line"><span>Poprawne odpowiedzi: ' + r.correct + ' × ' + r.stawka + ' pkt</span><strong>' + r.correct * r.stawka + '</strong></div>' +
        '<div class="calc-line"><span>Premie za serie</span><strong>+' + r.premie + '</strong></div>' +
        (r.hintsUsed ? '<div class="calc-line"><span>' + (r.hintsUsed === 1 ? 'Podpowiedź' : 'Podpowiedzi') + ': ' + r.hintsUsed + ' × ' + (r.hintCost ? '−' + HINT_COST + ' pkt' : 'za darmo') + '</span><strong>' + (r.hintCost ? '−' + r.hintCost : '0') + '</strong></div>' : '') +
        (rawSum < 0 ? '<div class="calc-line"><span>Wynik rundy nie spada poniżej zera</span><strong>+' + (-rawSum) + '</strong></div>' : '') +
        '<div class="calc-line calc-line--total"><span>Razem</span><span>' + r.points + ' pkt</span></div>';

      var cats = r.byCat.map(function (c) {
        var full = c.ok === c.all;
        return '<div class="cat-result"><div class="cat-result-head"><span>' + c.nazwa + '</span><span>' + c.ok + ' z ' + c.all + '</span></div>' +
          '<div class="bar' + (full ? '' : ' bar--warn') + '" role="progressbar" aria-label="' + c.nazwa + '" aria-valuemin="0" aria-valuemax="' + c.all + '" aria-valuenow="' + c.ok + '"><span style="width:' + (c.ok / c.all * 100) + '%"></span></div></div>';
      }).join('');

      var review = r.wrong.length ? '<div class="auto-grid" style="gap:16px">' + r.wrong.map(function (x) {
        return '<div class="review-item"><div class="review-word">' + BP.esc(x.word.slowo) + '</div>' +
          '<div>' + (x.timeout ? 'Zabrakło czasu na odpowiedź.' : 'Twoja odpowiedź: <s>' + BP.esc(x.given) + '</s>') + '</div>' +
          '<div class="review-tip">' + BP.esc(/^Zapamiętaj/.test(x.word.zasada) ? x.word.zasada : 'Zapamiętaj: ' + x.word.zasada) + '</div></div>';
      }).join('') + '</div>' : '<p class="congrats">Bez ani jednego błędu! Gratulacje, tak trzymać.</p>';

      root.innerHTML = '<main class="wrap wrap--mid page page--tight" style="padding-top:40px">' +
        '<section class="result-hero"><div class="result-hero-main">' +
          '<div class="eyebrow">Koniec rundy · poziom ' + lvl.nazwa + '</div>' +
          '<h1 tabindex="-1" data-autofocus>' + title + '</h1><p>' + sub + '</p>' +
          '<div class="stars" role="img" aria-label="' + r.stars + ' ' + BP.plural(r.stars, 'gwiazdka', 'gwiazdki', 'gwiazdek') + ' z 3">' + stars + '</div></div>' +
          '<div class="score-box"><div class="muted">Punkty w tej rundzie</div><div class="big">' + r.points + '</div>' +
          '<div style="font-weight:700">Razem masz już ' + r.total + ' pkt</div></div></section>' +
        '<div class="row"><section class="card" style="flex:1 1 340px;gap:12px"><h2>Jak policzyliśmy punkty</h2>' + calc + '</section>' +
          '<section class="card" style="flex:1 1 340px"><h2>Wynik według zasad</h2>' + cats + '</section></div>' +
        '<section class="card"><h2>Słowa do powtórki</h2>' + review + '</section>' +
        '<div class="btn-row"><button type="button" class="btn btn--orange btn--lg" data-action="again">Zagraj jeszcze raz</button>' +
          (r.wrong.length ? '<button type="button" class="btn btn--outline btn--lg" data-action="repeatErrors">Powtórz błędy (' + r.wrong.length + ')</button>' : '') +
          '<a class="btn btn--ghost btn--lg" href="#start">Wróć na start</a></div>' +
        '</main>';
    }
  };

  BP.actions.again = function () { BP.game.start(BP.lastResult.opts); };
  BP.actions.repeatErrors = function () {
    BP.game.start({ slowa: BP.lastResult.wrong.map(function (x) { return x.word.id; }) });
  };
})();
