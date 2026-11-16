
(() => {
  'use strict';

  const K_SETS = 'gym-series-v1';
  const K_EX = 'gym-ejercicios-v1';

  const BASE = [
    'Press de banca',
    'Sentadilla',
    'Peso muerto',
    'Press militar',
    'Remo con barra',
    'Dominadas',
    'Press inclinado con mancuernas',
    'Prensa de piernas',
    'Hip thrust',
    'Curl de bíceps',
    'Extensión de tríceps'
  ];

  const $ = id => document.getElementById(id);

  const read = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k)) || d;
    } catch {
      return d;
    }
  };

  let sets = read(K_SETS, []);
  let custom = read(K_EX, []);

  const persist = () => {
    try {
      localStorage.setItem(K_SETS, JSON.stringify(sets));
      localStorage.setItem(K_EX, JSON.stringify(custom));
    } catch {}
  };

  const num = n => n.toLocaleString('es', {
    maximumFractionDigits: 1
  });

  const e1rm = (w, r) => r <= 1 ? w : w * (1 + r / 30);

  const dmy = d => d.split('-').reverse().join('/');

  const today = () => new Date().toLocaleDateString('sv-SE');

  const pct = (a, b) => b ? ((a - b) / b) * 100 : null;

  const delta = p => p === null ? '' : `${p > 0 ? '+' : ''}${num(p)}%`;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

  const newId = () =>
    String(Date.now()) + Math.random().toString(36).slice(2, 6);

  /* DATOS DE ENTRENAMIENTO */

  function sessionsOf(ex) {
    const by = {};

    sets.filter(s => s.exercise === ex).forEach(s =>
      (by[s.date] ||= []).push(s)
    );

    return Object.keys(by).sort().map(date => {
      const list = by[date];

      const top = list.reduce((a, b) =>
        e1rm(b.weight, b.reps) > e1rm(a.weight, a.reps) ? b : a
      );

      const rirs = list.filter(s => s.rir !== null);

      return {
        date,
        list,
        top,
        count: list.length,
        e1rm: e1rm(top.weight, top.reps),
        volume: list.reduce((t, s) => t + s.weight * s.reps, 0),
        maxW: Math.max(...list.map(s => s.weight)),
        rir: rirs.length
          ? rirs.reduce((t, s) => t + s.rir, 0) / rirs.length
          : null
      };
    });
  }

  /* EJERCICIOS */

  function fillExercises(selected) {
    $('exercise').innerHTML = [...BASE, ...custom]
      .map(e => `<option>${esc(e)}</option>`)
      .join('');

    if (selected) $('exercise').value = selected;
  }

  function prefill() {
    const last = sets
      .filter(s => s.exercise === $('exercise').value)
      .slice(-1)[0];

    $('weight').value = last ? last.weight : '';
    $('reps').value = last ? last.reps : '';
    $('rir').value = last && last.rir !== null ? last.rir : '';
    $('rest').value = last && last.rest !== null ? last.rest : '';
  }

  function status(msg, bad) {
    $('status').textContent = msg;
    $('status').classList.toggle('error', !!bad);
  }

  /* RENDERIZADO */

  function renderHint(ss) {
    const last = ss[ss.length - 1];

    $('hint').textContent = last
      ? `Última sesión (${dmy(last.date)}): ${last.list.map(s =>
          `${num(s.weight)}×${s.reps}`
        ).join(', ')}. Para progresar, supera alguna serie.`
      : '';
  }

  const card = (big, unit, label, sub) => `
    <div class="stat">
      <div class="num">${big}<span>${unit}</span></div>
      <div class="lab">${label}</div>
      <div class="sub">${sub}</div>
    </div>
  `;

  function renderStats(ss) {
    const el = $('stats');

    if (!ss.length) {
      el.innerHTML = '';
      return;
    }

    const best = ss.reduce((a, b) => b.e1rm > a.e1rm ? b : a);
    const last = ss[ss.length - 1];
    const prev = ss[ss.length - 2];

    const maxW = Math.max(...ss.map(s => s.maxW));

    const change = (a, b) => {
      if (!prev) return 'Primera sesión';

      const p = pct(a, b);

      return `<span class="${p > 0 ? 'up' : ''}">
        ${delta(p)}
      </span> frente al ${dmy(prev.date)}`;
    };

    el.innerHTML =
      card(
        num(best.e1rm),
        'kg',
        'Mejor 1RM estimado',
        `${num(best.top.weight)} kg × ${best.top.reps}, ${dmy(best.date)}`
      ) +
      card(
        num(maxW),
        'kg',
        'Peso máximo',
        `${ss.length} sesiones registradas`
      ) +
      card(
        num(last.volume),
        'kg',
        'Volumen última sesión',
        change(last.volume, prev && prev.volume)
      ) +
      card(
        num(last.e1rm),
        'kg',
        '1RM última sesión',
        change(last.e1rm, prev && prev.e1rm)
      );
  }

  /* GRÁFICO */

  function drawChart(ss) {
    const c = $('chart');
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;

    c.width = w * dpr;
    c.height = h * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const css = getComputedStyle(document.documentElement);
    const col = n => css.getPropertyValue(n).trim();

    ctx.font = '13px DM Sans';

    if (!ss.length) {
      ctx.fillStyle = col('--muted');
      ctx.textAlign = 'center';
      ctx.fillText('Anota series para ver tu progreso', w / 2, h / 2);
      return;
    }

    const key = $('metric').value;
    const vals = ss.map(s => s[key]);

    let min = Math.min(...vals);
    let max = Math.max(...vals);

    if (min === max) {
      min -= 1;
      max += 1;
    } else {
      const p = (max - min) * .15;
      min -= p;
      max += p;
    }

    const pad = { l: 52, r: 18, t: 14, b: 30 };

    const x = i =>
      ss.length === 1
        ? pad.l + (w - pad.l - pad.r) / 2
        : pad.l + (i * (w - pad.l - pad.r)) / (ss.length - 1);

    const y = v =>
      pad.t + (h - pad.t - pad.b) * (1 - (v - min) / (max - min));

    ctx.strokeStyle = col('--line');
    ctx.fillStyle = col('--muted');
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const v = min + ((max - min) * i) / 4;
      const yy = y(v);

      ctx.beginPath();
      ctx.moveTo(pad.l, yy);
      ctx.lineTo(w - pad.r, yy);
      ctx.stroke();

      ctx.fillText(num(v), pad.l - 8, yy + 4);
    }

    ctx.textAlign = 'center';

    const step = Math.ceil(ss.length / 6);

    ss.forEach((s, i) => {
      if (i % step === 0 || i === ss.length - 1) {
        ctx.fillText(dmy(s.date).slice(0, 5), x(i), h - 8);
      }
    });

    ctx.strokeStyle = col('--blue');
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    vals.forEach((v, i) =>
      i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))
    );

    ctx.stroke();

    let record = -Infinity;

    vals.forEach((v, i) => {
      const isPR = i > 0 && v > record;
      record = Math.max(record, v);

      ctx.beginPath();
      ctx.arc(x(i), y(v), isPR ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isPR ? col('--red') : col('--paper');
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = isPR ? col('--red') : col('--blue');
      ctx.stroke();
    });
  }

  /* TABLA DE SESIONES */

  function renderSessions(ss) {
    const t = $('sessions');

    if (!ss.length) {
      t.innerHTML =
        '<caption class="empty">Aún no hay sesiones de este ejercicio.</caption>';
      return;
    }

    const rows = ss.map((s, i) => {
      const p = i ? pct(s.e1rm, ss[i - 1].e1rm) : null;

      return `
        <tr>
          <td>${dmy(s.date)}</td>
          <td class="n">${s.count}</td>
          <td>${num(s.top.weight)} kg × ${s.top.reps}</td>
          <td class="n">${num(s.e1rm)} kg</td>
          <td class="n">${num(s.volume)} kg</td>
          <td class="n">${s.rir === null ? '–' : num(s.rir)}</td>
          <td class="n ${p > 0 ? 'up' : ''}">
            ${p === null ? '–' : delta(p)}
          </td>
        </tr>
      `;
    }).reverse().join('');

    t.innerHTML = `
      <thead>
        <tr>
          <th>Fecha</th>
          <th class="n">Series</th>
          <th>Mejor serie</th>
          <th class="n">1RM est.</th>
          <th class="n">Volumen</th>
          <th class="n">RIR medio</th>
          <th class="n">Cambio 1RM</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    `;
  }

  /* TABLA DE SERIES */

  function renderSets(ex) {
    const t = $('sets');

    const list = sets
      .filter(s => s.exercise === ex)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 40);

    if (!list.length) {
      t.innerHTML =
        '<caption class="empty">Todavía no hay series. Anota la primera.</caption>';
      return;
    }

    t.innerHTML = `
      <thead>
        <tr>
          <th>Fecha</th>
          <th class="n">Peso</th>
          <th class="n">Reps</th>
          <th class="n">RIR</th>
          <th class="n">Descanso</th>
          <th>Notas</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(s => `
          <tr>
            <td>${dmy(s.date)}</td>
            <td class="n">${num(s.weight)} kg</td>
            <td class="n">${s.reps}</td>
            <td class="n">${s.rir === null ? '–' : s.rir}</td>
            <td class="n">${s.rest === null ? '–' : s.rest + ' s'}</td>
            <td>${esc(s.note)}</td>
            <td>
              <button type="button" class="del"
                data-id="${esc(s.id)}">Borrar</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
  }

  function render() {
    const ex = $('exercise').value;
    const ss = sessionsOf(ex);

    $('progTitle').textContent = `Evolución: ${ex}`;

    renderHint(ss);
    renderStats(ss);
    drawChart(ss);
    renderSessions(ss);
    renderSets(ex);
  }

  /* EVENTOS DE ENTRENAMIENTO */

  $('form').addEventListener('submit', e => {
    e.preventDefault();

    const weight = parseFloat($('weight').value);
    const reps = parseInt($('reps').value, 10);

    if (!(weight >= 0) || !(reps >= 1)) {
      status('Indica el peso y al menos 1 repetición.', true);
      return;
    }

    const opt = id =>
      $('' + id).value === '' ? null : Number($(id).value);

    sets.push({
      id: newId(),
      date: $('date').value || today(),
      exercise: $('exercise').value,
      weight,
      reps,
      rir: opt('rir'),
      rest: opt('rest'),
      note: $('note').value.trim()
    });

    persist();
    $('note').value = '';

    status(`Serie guardada: ${num(weight)} kg × ${reps}`);

    render();
    $('reps').focus();
  });

  $('addExercise').addEventListener('click', () => {
    const name = $('newExercise').value.trim();

    if (!name) return;

    const found = [...BASE, ...custom].find(
      x => x.toLowerCase() === name.toLowerCase()
    );

    if (!found) {
      custom.push(name);
      persist();
    }

    fillExercises(found || name);
    $('newExercise').value = '';

    prefill();
    render();
  });

  $('newExercise').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      $('addExercise').click();
    }
  });

  $('exercise').addEventListener('change', () => {
    status('');
    prefill();
    render();
  });

  $('metric').addEventListener('change', () =>
    drawChart(sessionsOf($('exercise').value))
  );

  window.addEventListener('resize', () =>
    drawChart(sessionsOf($('exercise').value))
  );

  $('sets').addEventListener('click', e => {
    const b = e.target.closest('.del');

    if (!b || !confirm('¿Borrar esta serie?')) return;

    sets = sets.filter(s => s.id !== b.dataset.id);

    persist();
    render();
  });

  $('export').addEventListener('click', () => {
    const rows = [[
      'fecha', 'ejercicio', 'peso_kg', 'reps',
      'rir', 'descanso_s', '1rm_estimado', 'nota'
    ]];

    sets.slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(s => rows.push([
        s.date,
        s.exercise,
        s.weight,
        s.reps,
        s.rir ?? '',
        s.rest ?? '',
        e1rm(s.weight, s.reps).toFixed(1),
        s.note
      ]));

    const csv = rows.map(r =>
      r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const a = document.createElement('a');

    a.href = URL.createObjectURL(
      new Blob(['\ufeff' + csv], {
        type: 'text/csv;charset=utf-8'
      })
    );

    a.download = 'mis-series-gimnasio.csv';
    a.click();

    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* CAMBIO DE PESTAÑAS */

  const trainingPanel = $('trainingPanel');
  const foodPanel = $('foodPanel');

  document.querySelectorAll('[data-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      const showFood = tab.dataset.tab === 'food';

      trainingPanel.hidden = showFood;
      foodPanel.hidden = !showFood;

      document.querySelectorAll('[data-tab]').forEach(t => {
        t.classList.toggle('active', t === tab);
      });
    });
  });

  /* API DE ALIMENTOS: OPEN FOOD FACTS */

  const foodResults = $('foodResults');
  const foodStatus = $('foodStatus');

  const foodFmt = n =>
    Number(n).toLocaleString('es-AR', {
      maximumFractionDigits: 1
    });

  function makeFoodCard(p) {
    const n = p.nutriments || {};

    let kcal = Number(n['energy-kcal_100g']);

    if (!Number.isFinite(kcal)) {
      const kj = Number(n.energy_100g);
      kcal = Number.isFinite(kj) ? kj / 4.184 : null;
    }

    const protein = Number(n.proteins_100g || 0);
    const carbs = Number(n.carbohydrates_100g || 0);
    const fat = Number(n.fat_100g || 0);

    const name = esc(
      p.product_name || p.generic_name || 'Alimento sin nombre'
    );

    const brand = esc(p.brands || 'Marca no informada');
    const img = p.image_front_small_url || p.image_url;

    return `
      <article class="food-card"
        data-kcal="${kcal === null ? '' : kcal}">

        ${img
          ? `<img src="${esc(img)}" alt="" loading="lazy">`
          : '<div class="food-placeholder">🥗</div>'}

        <div>
          <h3>${name}</h3>

          <div class="food-brand">${brand}</div>

          <div class="food-kcal">
            ${kcal === null ? 'Sin dato' : foodFmt(kcal) + ' kcal'}
            <small>/ 100 g</small>
          </div>

          <div class="food-macros">
            Proteínas ${foodFmt(protein)} g ·
            Carbohidratos ${foodFmt(carbs)} g ·
            Grasas ${foodFmt(fat)} g
          </div>

          <label class="food-portion">
            Porción

            <input class="food-grams"
              type="number"
              min="1"
              max="5000"
              value="100"
              ${kcal === null ? 'disabled' : ''}>

            g

            <strong class="portion-kcal">
              ${kcal === null ? '—' : foodFmt(kcal) + ' kcal'}
            </strong>
          </label>
        </div>
      </article>
    `;
  }

  $('foodSearch').addEventListener('submit', async e => {
    e.preventDefault();

    const query = $('foodQuery').value.trim();

    foodStatus.textContent = 'Buscando alimentos…';
    foodResults.innerHTML = '';

    try {
      const url =
        'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' +
        encodeURIComponent(query) +
        '&search_simple=1&action=process&json=1&page_size=16&fields=product_name,generic_name,brands,nutriments,image_front_small_url,image_url';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Error de conexión');
      }

      const data = await response.json();

      const products = (data.products || []).filter(
        p => p.product_name || p.generic_name
      );

      if (!products.length) {
        foodStatus.textContent =
          'No encontramos resultados. Probá con otro alimento.';
        return;
      }

      foodResults.innerHTML = products.map(makeFoodCard).join('');

      foodStatus.textContent =
        products.length + ' resultados. Calorías por 100 gramos.';

    } catch (error) {
      foodStatus.textContent =
        'No se pudo conectar con la API. Revisá tu conexión.';
    }
  });

  /* CALCULADORA DE PORCIONES */

  foodResults.addEventListener('input', e => {
    if (!e.target.classList.contains('food-grams')) return;

    const card = e.target.closest('.food-card');
    const kcal = Number(card.dataset.kcal);

    if (!Number.isFinite(kcal)) return;

    const grams = Math.max(0, Number(e.target.value) || 0);

    card.querySelector('.portion-kcal').textContent =
      foodFmt(kcal * grams / 100) + ' kcal';
  });

  /* INICIO DE LA APLICACIÓN */

  $('date').value = today();

  fillExercises();
  prefill();
  render();

})();
