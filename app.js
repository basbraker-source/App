(() => {
  'use strict';

  const STORAGE_KEY = 'bruiloftsplanner.v1';
  const SYNC_URL = 'sync.php';
  const SYNC_ENABLED = !window.PLANNER_NO_SYNC;
  const LISTS = ['tasks', 'budget', 'guests', 'vendors', 'tables', 'schedule'];

  const PHASES = [
    { id: 'p12', label: '12+ maanden vooraf', months: 12 },
    { id: 'p9', label: '9–12 maanden vooraf', months: 9 },
    { id: 'p6', label: '6–9 maanden vooraf', months: 6 },
    { id: 'p3', label: '3–6 maanden vooraf', months: 3 },
    { id: 'p1', label: '1–3 maanden vooraf', months: 1 },
    { id: 'p0', label: 'Laatste maand', months: 0.25 },
    { id: 'pw', label: 'Laatste week', months: 0 },
    { id: 'pd', label: 'Na de bruiloft', months: -1 },
  ];

  const DEFAULT_TASKS = {
    p12: ['Trouwdatum prikken', 'Totaalbudget bepalen', 'Eerste gastenlijst maken', 'Trouwlocatie bezoeken en boeken', 'Getuigen vragen', 'Trouwambtenaar of voorganger kiezen'],
    p9: ['Fotograaf boeken', 'Videograaf boeken', 'Catering of diner regelen', 'Muziek / DJ / band boeken', 'Save-the-dates versturen', 'Trouwjurk en pak uitzoeken'],
    p6: ['Huwelijksaankondiging bij de gemeente doen', 'Trouwkaarten ontwerpen en bestellen', 'Bloemist kiezen', 'Taart bestellen', 'Vervoer regelen', 'Huwelijksreis boeken', 'Overnachting voor gasten regelen'],
    p3: ['Trouwkaarten versturen', 'Trouwringen kopen', 'Ceremonie bespreken met ambtenaar', 'Draaiboek opstellen', 'Proefmake-up en kapsel', 'Cadeaulijst aanmaken'],
    p1: ['Reacties gasten nagaan', 'Tafelschikking maken', 'Speeches en geloften schrijven', 'Laatste pasbeurt kleding', 'Draaiboek delen met ceremoniemeester', 'Bedankjes voor gasten regelen'],
    p0: ['Definitief aantal gasten doorgeven', 'Laatste betalingen voldoen', 'Ringen ophalen', 'Noodpakketje samenstellen'],
    pw: ['Leveranciers nog één keer bevestigen', 'Koffers inpakken voor huwelijksreis', 'Enveloppen met betalingen klaarleggen', 'Op tijd naar bed!'],
    pd: ['Bedankkaartjes versturen', 'Kleding laten reinigen', 'Naamswijziging regelen (indien gewenst)', 'Foto’s en video bekijken en reviews schrijven'],
  };

  const DEFAULT_BUDGET = [
    ['Locatie & ceremonie', 0.20], ['Eten & drinken', 0.28], ['Fotografie & video', 0.12],
    ['Kleding & accessoires', 0.09], ['Ringen', 0.06], ['Muziek & entertainment', 0.07],
    ['Bloemen & decoratie', 0.07], ['Trouwkaarten & drukwerk', 0.03], ['Vervoer', 0.03],
    ['Haar & make-up', 0.02], ['Onvoorzien', 0.03],
  ];

  const SCHEDULE_TEMPLATE = [
    ['09:30', 'Haar & make-up', 'Visagist, thuis', ''],
    ['12:00', 'Aankleden en first look', 'Fotograaf & videograaf', ''],
    ['13:00', 'Aankomst gasten', 'Ceremonielocatie', 'Ceremoniemeester ontvangt gasten'],
    ['13:30', 'Ceremonie', 'Trouwambtenaar', 'Ringen bij getuige'],
    ['14:15', 'Felicitaties en toost', '', ''],
    ['15:30', 'Fotoshoot bruidspaar', 'Fotograaf', ''],
    ['17:30', 'Diner', 'Catering', 'Speeches tussen de gangen'],
    ['20:00', 'Aankomst avondgasten', '', ''],
    ['20:30', 'Openingsdans en taart', 'DJ', ''],
    ['00:30', 'Einde feest', '', 'Vervoer naar huis/hotel'],
  ];

  const VENDOR_STATUS = ['Oriënteren', 'Offerte aangevraagd', 'Geboekt', 'Betaald'];
  const RSVP = { open: 'Nog geen reactie', ja: 'Komt', nee: 'Komt niet' };

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const euro = (n) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const persons = (g) => Math.max(1, num(g.count));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  function freshState() {
    return {
      settings: { partner1: '', partner2: '', date: '', budget: 0, venue: '' },
      tasks: Object.entries(DEFAULT_TASKS).flatMap(([phase, list]) => list.map((title) => ({ id: uid(), title, phase, done: false }))),
      budget: DEFAULT_BUDGET.map(([name]) => ({ id: uid(), name, planned: 0, actual: 0, paid: 0 })),
      guests: [],
      vendors: [],
      tables: [],
      schedule: [],
      deleted: {},
      setupDone: false,
    };
  }

  function sanitize(d) {
    const base = freshState();
    if (!d || typeof d !== 'object') return base;
    const list = (k, fallback) => (Array.isArray(d[k]) ? d[k].filter((x) => x && typeof x === 'object' && x.id) : fallback);
    return {
      settings: { ...base.settings, ...(d.settings && typeof d.settings === 'object' ? d.settings : {}) },
      tasks: list('tasks', base.tasks),
      budget: list('budget', base.budget),
      guests: list('guests', []),
      vendors: list('vendors', []),
      tables: list('tables', []),
      schedule: list('schedule', []),
      deleted: d.deleted && typeof d.deleted === 'object' ? d.deleted : {},
      setupDone: !!d.setupDone,
    };
  }

  function load() {
    const raw = store.get(STORAGE_KEY);
    if (raw) { try { return sanitize(JSON.parse(raw)); } catch (e) { /* corrupt */ } }
    if (typeof window.PLANNER_DEMO === 'function') return sanitize(window.PLANNER_DEMO(freshState()));
    return freshState();
  }

  let state = load();

  /* ---------- Wijzigingen bijhouden (nodig om samen te plannen) ----------
     Elk onderdeel krijgt een tijdstempel (_u) als het verandert, en verwijderde onderdelen
     een 'grafsteen' in state.deleted. Zo kunnen wijzigingen van twee apparaten per onderdeel
     worden samengevoegd in plaats van elkaar te overschrijven. */
  const strip = (o) => { const { _u, ...rest } = o; return JSON.stringify(rest); };
  let snap = new Map();
  function takeSnap() {
    snap = new Map([['settings', strip(state.settings)], ['setupDone', String(state.setupDone)]]);
    LISTS.forEach((l) => state[l].forEach((i) => snap.set(l + ':' + i.id, strip(i))));
  }
  function stamp() {
    const now = Date.now();
    const seen = new Set(['settings', 'setupDone']);
    if (strip(state.settings) !== snap.get('settings')) state.settings._u = now;
    LISTS.forEach((l) => state[l].forEach((i) => {
      const k = l + ':' + i.id;
      seen.add(k);
      if (snap.get(k) !== strip(i)) i._u = now;
    }));
    snap.forEach((_, k) => { if (!seen.has(k)) state.deleted[k.slice(k.indexOf(':') + 1)] = now; });
    const cutoff = now - 180 * 86400000;
    Object.keys(state.deleted).forEach((id) => { if (state.deleted[id] < cutoff) delete state.deleted[id]; });
    takeSnap();
  }
  takeSnap();

  function merge(local, remote) {
    remote = sanitize(remote);
    const deleted = { ...remote.deleted };
    Object.entries(local.deleted).forEach(([id, t]) => { deleted[id] = Math.max(t, deleted[id] || 0); });
    const alive = (i) => !(deleted[i.id] && deleted[i.id] >= (i._u || 0));
    const out = {
      settings: (local.settings._u || 0) >= (remote.settings._u || 0) ? local.settings : remote.settings,
      setupDone: local.setupDone || remote.setupDone,
      deleted,
    };
    LISTS.forEach((l) => {
      const rmap = new Map(remote[l].map((i) => [i.id, i]));
      const result = [];
      local[l].forEach((i) => {
        const r = rmap.get(i.id);
        const pick = !r || (i._u || 0) >= (r._u || 0) ? i : r;
        if (alive(pick)) result.push(pick);
        rmap.delete(i.id);
      });
      rmap.forEach((r) => { if (alive(r)) result.push(r); });
      out[l] = result;
    });
    return out;
  }

  /* ---------- In-page dialog ---------- */
  function dialog(message, { ok = 'OK', cancel = null, danger = false } = {}) {
    return new Promise((resolve) => {
      const wrap = $('#dialog');
      $('#dialog-msg').textContent = message;
      const okBtn = $('#dialog-ok'), cancelBtn = $('#dialog-cancel');
      okBtn.textContent = ok;
      okBtn.classList.toggle('danger', danger);
      cancelBtn.hidden = !cancel;
      if (cancel) cancelBtn.textContent = cancel;
      wrap.hidden = false;
      okBtn.focus();
      const done = (v) => { wrap.hidden = true; okBtn.onclick = cancelBtn.onclick = wrap.onkeydown = null; resolve(v); };
      okBtn.onclick = () => done(true);
      cancelBtn.onclick = () => done(false);
      wrap.onkeydown = (e) => { if (e.key === 'Escape') done(false); };
    });
  }

  const saveLocal = () => store.set(STORAGE_KEY, JSON.stringify(state));
  const save = () => { stamp(); saveLocal(); markDirty(); };
  const commit = () => { save(); render(); };

  /* ---------- Tabs ---------- */
  function showTab(name) {
    $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    $$('.panel').forEach((p) => { p.hidden = p.id !== 'tab-' + name; });
    try { sessionStorage.setItem(STORAGE_KEY + '.tab', name); } catch (e) { /* ignore */ }
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  /* ---------- Header & countdown ---------- */
  function weddingDate() {
    const d = state.settings.date;
    if (!d) return null;
    const dt = new Date(d + 'T00:00:00');
    return isNaN(dt) ? null : dt;
  }

  function renderHeader() {
    const { partner1, partner2, venue } = state.settings;
    $('#couple-title').innerHTML = partner1 && partner2
      ? `${esc(partner1)} <span class="en">&amp;</span> ${esc(partner2)}`
      : 'Ons <em>trouwplan</em>';
    const wd = weddingDate();
    const parts = [];
    if (wd) parts.push(wd.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    if (venue) parts.push(venue);
    $('#hero-date').textContent = parts.join(' · ');
    renderCountdown();
  }

  function renderCountdown() {
    const el = $('#countdown');
    const wd = weddingDate();
    if (!wd) { el.innerHTML = ''; return; }
    const diff = wd - new Date();
    if (diff <= 0 && diff > -86400000) { el.innerHTML = '<span class="message">Vandaag is de grote dag!</span>'; return; }
    if (diff <= 0) { el.innerHTML = '<span class="message">Getrouwd! Gefeliciteerd.</span>'; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const unit = (n, l) => `<div class="unit"><span class="num">${n}</span><span class="lbl">${l}</span></div>`;
    el.innerHTML = unit(d, d === 1 ? 'dag' : 'dagen') + unit(h, 'uur') + unit(m, m === 1 ? 'minuut' : 'minuten');
  }

  /* ---------- Overview ---------- */
  function setBar(id, value, over = false) {
    const el = $(id);
    el.style.width = Math.min(100, Math.max(0, value)) + '%';
    el.classList.toggle('over', over);
  }

  function currentPhaseIndex() {
    const wd = weddingDate();
    if (!wd) return 0;
    const monthsLeft = (wd - new Date()) / (30.44 * 86400000);
    if (monthsLeft < 0) return PHASES.length - 1;
    const idx = PHASES.findIndex((p) => monthsLeft >= p.months);
    return idx === -1 ? PHASES.length - 2 : idx;
  }

  function renderOverview() {
    $('#welcome').hidden = state.setupDone;

    const done = state.tasks.filter((t) => t.done).length;
    const total = state.tasks.length;
    $('#stat-checklist').textContent = pct(done, total) + '%';
    $('#stat-checklist-sub').textContent = `${done} van ${total} taken afgerond`;
    setBar('#bar-checklist', pct(done, total));

    const budget = num(state.settings.budget);
    const spent = state.budget.reduce((s, b) => s + num(b.actual), 0);
    $('#stat-budget').textContent = euro(spent);
    $('#stat-budget-sub').textContent = budget ? `van ${euro(budget)} · ${euro(budget - spent)} over` : 'Stel een budget in';
    setBar('#bar-budget', pct(spent, budget), budget > 0 && spent > budget);

    const g = guestTotals();
    $('#stat-guests').textContent = g.yes;
    $('#stat-guests-sub').textContent = `van ${g.total} uitgenodigd`;
    setBar('#bar-guests', pct(g.yes + g.no, g.total));

    const booked = state.vendors.filter((v) => v.status === 'Geboekt' || v.status === 'Betaald').length;
    $('#stat-vendors').textContent = booked;
    $('#stat-vendors-sub').textContent = `van ${state.vendors.length} leveranciers`;
    setBar('#bar-vendors', pct(booked, state.vendors.length));

    const ci = currentPhaseIndex();
    const order = (t) => PHASES.findIndex((p) => p.id === t.phase);
    const open = state.tasks.filter((t) => !t.done).sort((a, b) => order(a) - order(b));
    const relevant = open.filter((t) => order(t) <= ci);
    const list = (relevant.length ? relevant : open).slice(0, 6);
    $('#upcoming').innerHTML = list.length
      ? list.map((t) => taskItem(t, true)).join('')
      : '<li class="empty">Alles afgevinkt. Goed bezig!</li>';
  }

  /* ---------- Checklist ---------- */
  let taskFilter = 'alle';

  function taskItem(t, showPhase = false) {
    const phase = PHASES.find((p) => p.id === t.phase);
    return `<li class="${t.done ? 'done' : ''}" data-id="${esc(t.id)}">
      <input type="checkbox" data-action="toggle-task" ${t.done ? 'checked' : ''} aria-label="Afvinken: ${esc(t.title)}">
      <span class="title">${esc(t.title)}</span>
      ${showPhase && phase ? `<span class="phase-tag">${esc(phase.label)}</span>` : ''}
      ${showPhase ? '' : '<button class="icon-btn" data-action="delete-task" title="Verwijderen" aria-label="Taak verwijderen">×</button>'}
    </li>`;
  }

  function renderChecklist() {
    const sel = $('#task-phase');
    if (!sel.options.length) {
      sel.innerHTML = PHASES.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
      sel.value = PHASES[currentPhaseIndex()].id;
    }
    const html = PHASES.map((p) => {
      const all = state.tasks.filter((t) => t.phase === p.id);
      const shown = all.filter((t) => taskFilter === 'alle' || (taskFilter === 'open' ? !t.done : t.done));
      if (!shown.length) return '';
      const done = all.filter((t) => t.done).length;
      return `<div class="card group">
        <div class="group-head"><h3>${esc(p.label)}</h3><span class="count">${done}/${all.length}</span></div>
        <ul class="task-list">${shown.map((t) => taskItem(t)).join('')}</ul>
      </div>`;
    }).join('');
    $('#checklist-groups').innerHTML = html || '<div class="card empty">Geen taken in deze weergave.</div>';
  }

  $('#task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const title = f.elements.title.value.trim();
    if (!title) return;
    state.tasks.push({ id: uid(), title, phase: f.elements.phase.value, done: false });
    f.elements.title.value = '';
    commit();
    f.elements.title.focus();
  });

  $$('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    taskFilter = b.dataset.filter;
    $$('[data-filter]').forEach((x) => x.classList.toggle('active', x === b));
    renderChecklist();
  }));

  /* ---------- Budget ---------- */
  function renderBudget() {
    renderBudgetSummary();
    const field = (b, k, label) => `<td class="num"><input type="number" min="0" step="10" value="${num(b[k]) || ''}" placeholder="0" data-field="${k}" aria-label="${label} ${esc(b.name)}"></td>`;
    $('#budget-rows').innerHTML = state.budget.length
      ? state.budget.map((b) => `<tr data-id="${esc(b.id)}" data-list="budget">
          <td><input value="${esc(b.name)}" data-field="name" aria-label="Naam post"></td>
          ${field(b, 'planned', 'Begroot')}${field(b, 'actual', 'Werkelijk')}${field(b, 'paid', 'Betaald')}
          <td><button class="icon-btn" data-action="delete-row" title="Verwijderen" aria-label="Post verwijderen">×</button></td>
        </tr>`).join('')
      : '<tr><td colspan="5" class="empty">Nog geen budgetposten.</td></tr>';
  }

  function renderBudgetSummary() {
    const total = num(state.settings.budget);
    const sum = (k) => state.budget.reduce((s, b) => s + num(b[k]), 0);
    const planned = sum('planned'), actual = sum('actual'), paid = sum('paid');
    $('#b-total').textContent = euro(total);
    $('#b-planned').textContent = euro(planned);
    $('#b-actual').textContent = euro(actual);
    $('#b-paid').textContent = `${euro(paid)} betaald · ${euro(Math.max(0, actual - paid))} nog te betalen`;
    $('#bt-planned').textContent = euro(planned);
    $('#bt-actual').textContent = euro(actual);
    $('#bt-paid').textContent = euro(paid);

    const note = $('#budget-note');
    note.classList.remove('warn');
    if (!total) {
      note.textContent = 'Tip: stel bij Instellingen een totaalbudget in, dan verdelen we het automatisch over de posten.';
    } else if (actual > total) {
      note.textContent = `Let op: jullie zitten ${euro(actual - total)} boven het budget.`;
      note.classList.add('warn');
    } else if (planned > total) {
      note.textContent = `De begroting is ${euro(planned - total)} hoger dan het totaalbudget.`;
      note.classList.add('warn');
    } else {
      note.textContent = `Nog ${euro(total - planned)} niet begroot.`;
    }
  }

  function distributeBudget(total) {
    const shares = Object.fromEntries(DEFAULT_BUDGET);
    state.budget.forEach((b) => {
      if (!num(b.planned) && shares[b.name]) b.planned = Math.round((total * shares[b.name]) / 50) * 50;
    });
  }

  $('#budget-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const name = f.elements.name.value.trim();
    if (!name) return;
    state.budget.push({ id: uid(), name, planned: num(f.elements.planned.value), actual: 0, paid: 0 });
    f.reset();
    commit();
    f.elements.name.focus();
  });

  /* ---------- Guests ---------- */
  function guestTotals() {
    const t = { total: 0, yes: 0, no: 0, open: 0, dag: 0, avond: 0 };
    state.guests.forEach((g) => {
      const c = persons(g);
      t.total += c;
      t[g.rsvp === 'ja' ? 'yes' : g.rsvp === 'nee' ? 'no' : 'open'] += c;
      t[g.type === 'avond' ? 'avond' : 'dag'] += c;
    });
    return t;
  }

  function renderGuestSummary() {
    const t = guestTotals();
    $('#g-total').textContent = t.total;
    $('#g-split').textContent = `${t.dag} daggasten · ${t.avond} avondgasten`;
    $('#g-yes').textContent = t.yes;
    $('#g-open').textContent = t.open;
    $('#g-no').textContent = `${t.no} komen niet`;
  }

  function renderGuests() {
    renderGuestSummary();
    const q = $('#guest-search').value.trim().toLowerCase();
    const list = state.guests.filter((g) => !q || (g.name + ' ' + (g.note || '')).toLowerCase().includes(q));
    $('#guest-rows').innerHTML = list.length
      ? list.map((g) => `<tr data-id="${esc(g.id)}" data-list="guests">
          <td><input value="${esc(g.name)}" data-field="name" aria-label="Naam"></td>
          <td class="num"><input type="number" min="1" value="${persons(g)}" data-field="count" aria-label="Aantal personen" style="min-width:60px"></td>
          <td><select data-field="type" aria-label="Type gast">
            <option value="dag" ${g.type !== 'avond' ? 'selected' : ''}>Dag</option>
            <option value="avond" ${g.type === 'avond' ? 'selected' : ''}>Avond</option></select></td>
          <td><select data-field="rsvp" class="status-${esc(g.rsvp)}" aria-label="Reactie">
            ${Object.entries(RSVP).map(([k, l]) => `<option value="${k}" ${g.rsvp === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
          <td><input value="${esc(g.note || '')}" data-field="note" placeholder="—" aria-label="Opmerking"></td>
          <td><button class="icon-btn" data-action="delete-row" title="Verwijderen" aria-label="Gast verwijderen">×</button></td>
        </tr>`).join('')
      : `<tr><td colspan="6" class="empty">${state.guests.length ? 'Geen gasten gevonden.' : 'Nog geen gasten toegevoegd.'}</td></tr>`;
  }

  $('#guest-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const name = f.elements.name.value.trim();
    if (!name) return;
    state.guests.push({ id: uid(), name, count: persons({ count: f.elements.count.value }), type: f.elements.type.value, rsvp: 'open', note: '', tableId: '' });
    f.elements.name.value = '';
    f.elements.count.value = 1;
    commit();
    f.elements.name.focus();
  });
  $('#guest-search').addEventListener('input', renderGuests);

  /* ---------- Tafelschikking ---------- */
  let seatFilter = 'dag';
  const tableById = (id) => state.tables.find((t) => t.id === id);
  const seatedAt = (tid) => state.guests.filter((g) => g.tableId === tid && g.rsvp !== 'nee');
  const used = (tid) => seatedAt(tid).reduce((s, g) => s + persons(g), 0);

  function renderSeatingSummary() {
    const pool = state.guests.filter((g) => g.rsvp !== 'nee' && (seatFilter === 'alle' || (g.type === 'avond' ? 'avond' : 'dag') === seatFilter));
    const seated = pool.filter((g) => tableById(g.tableId)).reduce((s, g) => s + persons(g), 0);
    const all = pool.reduce((s, g) => s + persons(g), 0);
    const seats = state.tables.reduce((s, t) => s + Math.max(0, num(t.seats)), 0);
    $('#s-tables').textContent = state.tables.length;
    $('#s-seats').textContent = `${seats} stoelen`;
    $('#s-seated').textContent = seated;
    $('#s-open').textContent = all - seated;
    state.tables.forEach((t) => {
      const el = document.getElementById('tv-' + t.id);
      if (el) el.innerHTML = tableSvg(used(t.id), Math.max(0, num(t.seats)));
    });
    return pool;
  }

  // Ronde tafel met stoelen eromheen: gevuld = bezet, rood = te veel mensen.
  function tableSvg(n, cap) {
    const total = Math.min(Math.max(cap, n), 24);
    const r = total > 14 ? 74 : 68;
    let chairs = '';
    for (let i = 0; i < total; i++) {
      const a = (i / total) * Math.PI * 2 - Math.PI / 2;
      const cls = i < Math.min(n, cap) ? 'stoel bezet' : i < cap ? 'stoel' : 'stoel teveel';
      chairs += `<circle class="${cls}" cx="${(85 + r * Math.cos(a)).toFixed(1)}" cy="${(85 + r * Math.sin(a)).toFixed(1)}" r="${total > 14 ? 6 : 8}"/>`;
    }
    return `<svg viewBox="0 0 170 170" role="img" aria-label="${n} van ${cap} plaatsen bezet">
      <circle class="tafel${n > cap ? ' vol' : ''}" cx="85" cy="85" r="50"/>${chairs}
      <text x="85" y="88" text-anchor="middle">${n}/${cap}</text>
      <text class="klein" x="85" y="106" text-anchor="middle">${n > cap ? 'TE VOL' : 'BEZET'}</text>
    </svg>`;
  }

  function guestChip(g, inTable) {
    return `<li draggable="true" data-guest="${esc(g.id)}">
      <span class="title">${esc(g.name)}</span>
      <span class="chip-meta">${persons(g)}p${g.type === 'avond' ? ' · avond' : ''}${g.note ? ' · ' + esc(g.note) : ''}</span>
      ${inTable ? `<button class="icon-btn" data-action="unseat" data-guest="${esc(g.id)}" title="Van tafel halen" aria-label="${esc(g.name)} van tafel halen">×</button>` : ''}
    </li>`;
  }

  function renderSeating(keepCards) {
    const pool = renderSeatingSummary();
    const unseated = pool.filter((g) => !tableById(g.tableId));
    const options = state.tables.map((t) => {
      const free = Math.max(0, num(t.seats)) - used(t.id);
      return `<option value="${esc(t.id)}">${esc(t.name || 'Tafel')} · ${free} vrij</option>`;
    }).join('');
    $('#unseated').innerHTML = unseated.length
      ? unseated.map((g) => `<li draggable="true" data-guest="${esc(g.id)}">
          <span class="title">${esc(g.name)}</span>
          <span class="chip-meta">${persons(g)}p${g.type === 'avond' ? ' · avond' : ''}</span>
          ${state.tables.length ? `<select data-action="seat" data-guest="${esc(g.id)}" aria-label="Tafel kiezen voor ${esc(g.name)}"><option value="">Kies tafel</option>${options}</select>` : ''}
        </li>`).join('')
      : `<li class="empty">${pool.length ? 'Iedereen heeft een plek.' : 'Nog geen gasten. Voeg ze toe bij Gasten.'}</li>`;
    $('#seat-hint').hidden = state.tables.length > 0;

    if (keepCards) return;
    $('#tables').innerHTML = state.tables.map((t) => `
      <div class="card table-card" data-list="tables" data-id="${esc(t.id)}" data-drop="${esc(t.id)}">
        <div class="table-head">
          <input class="table-name" value="${esc(t.name)}" data-field="name" aria-label="Tafelnaam">
          <button class="icon-btn" data-action="delete-row" title="Tafel verwijderen" aria-label="Tafel verwijderen">×</button>
        </div>
        <div class="table-visual" id="tv-${esc(t.id)}"></div>
        <div class="table-meta">
          <label class="mono">stoelen <input type="number" min="1" value="${Math.max(1, num(t.seats))}" data-field="seats" aria-label="Aantal stoelen"></label>
        </div>
        <ul class="seat-list">${seatedAt(t.id).map((g) => guestChip(g, true)).join('') || '<li class="empty">Sleep gasten hierheen of kies een tafel.</li>'}</ul>
      </div>`).join('');
    renderSeatingSummary();
  }

  $('#table-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const name = f.elements.name.value.trim() || `Tafel ${state.tables.length + 1}`;
    state.tables.push({ id: uid(), name, seats: Math.max(1, num(f.elements.seats.value) || 8) });
    f.elements.name.value = '';
    commit();
    f.elements.name.focus();
  });

  $$('[data-seatfilter]').forEach((b) => b.addEventListener('click', () => {
    seatFilter = b.dataset.seatfilter;
    $$('[data-seatfilter]').forEach((x) => x.classList.toggle('active', x === b));
    renderSeating();
  }));

  function seatGuest(gid, tid) {
    const g = state.guests.find((x) => x.id === gid);
    if (!g || (g.tableId || '') === tid) return;
    g.tableId = tid;
    commit();
  }

  // Slepen (computer)
  document.addEventListener('dragstart', (e) => {
    const li = e.target.closest && e.target.closest('[data-guest]');
    if (!li) return;
    e.dataTransfer.setData('text/plain', li.dataset.guest);
    e.dataTransfer.effectAllowed = 'move';
    li.classList.add('dragging');
  });
  document.addEventListener('dragend', (e) => {
    const li = e.target.closest && e.target.closest('[data-guest]');
    if (li) li.classList.remove('dragging');
    $$('.drop-hover').forEach((x) => x.classList.remove('drop-hover'));
  });
  document.addEventListener('dragover', (e) => {
    const zone = e.target.closest && e.target.closest('[data-drop]');
    if (!zone) return;
    e.preventDefault();
    $$('.drop-hover').forEach((x) => x !== zone && x.classList.remove('drop-hover'));
    zone.classList.add('drop-hover');
  });
  document.addEventListener('drop', (e) => {
    const zone = e.target.closest && e.target.closest('[data-drop]');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('drop-hover');
    seatGuest(e.dataTransfer.getData('text/plain'), zone.dataset.drop);
  });

  /* ---------- Draaiboek ---------- */
  // Tijd altijd als 24-uurs HH:MM, ook als iemand '1330', '9.5' of '13u30' typt.
  function normTime(v) {
    const t = String(v || '').trim();
    const m = t.match(/^(\d{1,2})(\d{2})$/) || t.match(/^(\d{1,2})(?:[:.,u h]?(\d{1,2}))?$/i);
    if (!m) return '';
    const h = Math.min(23, parseInt(m[1], 10)), min = Math.min(59, parseInt(m[2] || '0', 10) * (m[2] && m[2].length === 1 ? 10 : 1));
    return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
  }

  // Tijden na middernacht (tot 06:00) horen bij het einde van de dag.
  const timeKey = (t) => (!t ? '99:99' : t < '06:00' ? String(24 + parseInt(t, 10)) + t.slice(2) : t);
  const byTime = (a, b) => timeKey(a.time).localeCompare(timeKey(b.time));

  function renderSchedule() {
    const items = [...state.schedule].sort(byTime);
    $('#schedule-template').hidden = items.length > 0;
    $('#timeline').innerHTML = items.length
      ? items.map((s) => `<li data-id="${esc(s.id)}" data-list="schedule">
          <input class="tl-tijd" inputmode="numeric" maxlength="5" placeholder="--:--" value="${esc(s.time)}" data-field="time" aria-label="Tijd">
          <span class="dot"></span>
          <div>
            <input class="tl-titel" value="${esc(s.title)}" data-field="title" aria-label="Onderdeel">
            <div class="tl-sub">
              <input value="${esc(s.who || '')}" data-field="who" placeholder="Wie of waar" aria-label="Wie of waar">
              <input value="${esc(s.note || '')}" data-field="note" placeholder="Notitie" aria-label="Notitie">
            </div>
          </div>
          <button class="icon-btn" data-action="delete-row" title="Verwijderen" aria-label="Onderdeel verwijderen">×</button>
        </li>`).join('')
      : '<li class="empty">Nog geen programma. Voeg een onderdeel toe of begin met het voorbeeldprogramma.</li>';
  }

  $('#schedule-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const title = f.elements.title.value.trim();
    if (!title) return;
    state.schedule.push({ id: uid(), time: normTime(f.elements.time.value), title, who: f.elements.who.value.trim(), note: '' });
    f.elements.title.value = '';
    f.elements.who.value = '';
    commit();
    f.elements.time.focus();
  });

  $('#schedule-template').addEventListener('click', () => {
    SCHEDULE_TEMPLATE.forEach(([time, title, who, note]) => state.schedule.push({ id: uid(), time, title, who, note }));
    commit();
  });

  /* ---------- Vendors ---------- */
  function renderVendors() {
    $('#vendor-rows').innerHTML = state.vendors.length
      ? state.vendors.map((v) => `<tr data-id="${esc(v.id)}" data-list="vendors">
          <td><input value="${esc(v.category)}" data-field="category" aria-label="Soort"></td>
          <td><input value="${esc(v.name || '')}" data-field="name" placeholder="—" aria-label="Naam"></td>
          <td><input value="${esc(v.contact || '')}" data-field="contact" placeholder="—" aria-label="Contact"></td>
          <td><select data-field="status" aria-label="Status">
            ${VENDOR_STATUS.map((s) => `<option ${v.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
          <td><input value="${esc(v.note || '')}" data-field="note" placeholder="—" aria-label="Notitie"></td>
          <td><button class="icon-btn" data-action="delete-row" title="Verwijderen" aria-label="Leverancier verwijderen">×</button></td>
        </tr>`).join('')
      : '<tr><td colspan="6" class="empty">Nog geen leveranciers. Voeg bijvoorbeeld je fotograaf, DJ of bloemist toe.</td></tr>';
  }

  $('#vendor-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const category = f.elements.category.value.trim();
    if (!category) return;
    state.vendors.push({ id: uid(), category, name: f.elements.name.value.trim(), contact: f.elements.contact.value.trim(), status: VENDOR_STATUS[0], note: '' });
    f.reset();
    commit();
    f.elements.category.focus();
  });

  /* ---------- Bewerken in lijsten ---------- */
  const NUMERIC = new Set(['planned', 'actual', 'paid', 'count', 'seats']);

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.action === 'toggle-task') {
      const task = state.tasks.find((x) => x.id === t.closest('li').dataset.id);
      if (task) { task.done = t.checked; commit(); }
      return;
    }
    if (t.dataset.action === 'seat') { seatGuest(t.dataset.guest, t.value); return; }

    const field = t.dataset.field;
    const row = t.closest('[data-list]');
    if (!field || !row) return;
    const list = row.dataset.list;
    const item = state[list].find((x) => x.id === row.dataset.id);
    if (!item) return;
    item[field] = NUMERIC.has(field) ? num(t.value) : field === 'time' ? normTime(t.value) : t.value.trim();
    if (field === 'rsvp') {
      t.className = 'status-' + item.rsvp;
      if (item.rsvp === 'nee') item.tableId = '';
    }
    save();
    // De lijst die je bewerkt blijft staan, zodat je met Tab kunt doorgaan.
    render(field === 'time' ? null : list);
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'delete-row') {
      const row = btn.closest('[data-list]');
      const list = row.dataset.list, id = row.dataset.id;
      state[list] = state[list].filter((x) => x.id !== id);
      if (list === 'tables') state.guests.forEach((g) => { if (g.tableId === id) g.tableId = ''; });
      commit();
    } else if (action === 'delete-task') {
      const id = btn.closest('li').dataset.id;
      state.tasks = state.tasks.filter((t) => t.id !== id);
      commit();
    } else if (action === 'unseat') {
      seatGuest(btn.dataset.guest, '');
    }
  });

  /* ---------- Settings ---------- */
  function applySettings(form) {
    const prevBudget = num(state.settings.budget);
    state.settings = {
      ...state.settings,
      partner1: form.elements.partner1.value.trim(),
      partner2: form.elements.partner2.value.trim(),
      date: form.elements.date.value,
      budget: num(form.elements.budget.value),
      venue: form.elements.venue ? form.elements.venue.value.trim() : (state.settings.venue || ''),
    };
    if (state.settings.budget && state.settings.budget !== prevBudget) distributeBudget(state.settings.budget);
  }

  function fillSettingsForm() {
    const f = $('#settings-form').elements;
    const s = state.settings;
    f.partner1.value = s.partner1 || ''; f.partner2.value = s.partner2 || '';
    f.date.value = s.date || ''; f.budget.value = s.budget || ''; f.venue.value = s.venue || '';
  }

  $('#welcome-form').addEventListener('submit', (e) => {
    e.preventDefault();
    applySettings(e.target);
    state.setupDone = true;
    commit();
  });

  $('#welcome-join').addEventListener('click', () => {
    showTab('instellingen');
    const input = $('#sync-join [name=code]');
    input.scrollIntoView({ block: 'center' });
    input.focus();
  });

  $('#settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    applySettings(e.target);
    state.setupDone = true;
    commit();
    const msg = $('#settings-saved');
    msg.hidden = false;
    setTimeout(() => { msg.hidden = true; }, 2000);
  });

  $('#export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bruiloftsplanner-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('#import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      e.target.value = '';
      let data;
      try { data = JSON.parse(reader.result); } catch (err) {
        await dialog('Dit bestand kon niet worden gelezen. Kies een back-up van de bruiloftsplanner (.json).');
        return;
      }
      if (!(await dialog('De huidige planning wordt vervangen door de back-up. Doorgaan?', { ok: 'Terugzetten', cancel: 'Annuleren' }))) return;
      const keepDeleted = state.deleted;
      state = sanitize(data);
      state.deleted = { ...keepDeleted, ...state.deleted };
      commit();
      await dialog('Back-up teruggezet.');
    };
    reader.readAsText(file);
  });

  $('#print-btn').addEventListener('click', () => window.print());

  $('#reset-btn').addEventListener('click', async () => {
    const msg = sync.code
      ? 'De planning op dit apparaat wordt gewist en dit apparaat wordt ontkoppeld. De gedeelde planning van je partner blijft bestaan.'
      : 'Weet je zeker dat je alle gegevens wilt wissen? Dit kan niet ongedaan worden gemaakt.';
    if (!(await dialog(msg, { ok: 'Alles wissen', cancel: 'Annuleren', danger: true }))) return;
    unlink();
    state = freshState();
    takeSnap();
    saveLocal();
    render();
    showTab('overzicht');
  });

  /* ---------- Samen plannen (synchronisatie via sync.php) ---------- */
  const SYNC_KEY = STORAGE_KEY + '.sync';
  let sync = { code: '', version: 0, dirty: false };
  try { sync = { ...sync, ...JSON.parse(store.get(SYNC_KEY) || '{}') }; } catch (e) { /* ignore */ }
  const saveSync = () => (sync.code ? store.set(SYNC_KEY, JSON.stringify(sync)) : store.del(SYNC_KEY));
  let syncAvailable = false, busy = false, again = false, pushTimer = null, lastSynced = null, syncError = '';

  const formatCode = (c) => c.replace(/(.{4})(?=.)/g, '$1-');

  async function api(method, payload, query = '') {
    const res = await fetch(SYNC_URL + query, {
      method,
      headers: payload ? { 'Content-Type': 'application/json' } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      cache: 'no-store',
    });
    let body = {};
    try { body = await res.json(); } catch (e) { /* ignore */ }
    return { status: res.status, body };
  }

  function markDirty() {
    if (!sync.code) return;
    sync.dirty = true;
    saveSync();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(syncNow, 800);
    renderSync();
  }

  // Alleen wachten met bijwerken als iemand op dit moment typt.
  let lastTyped = 0;
  document.addEventListener('input', () => { lastTyped = Date.now(); });
  function userIsEditing() {
    const a = document.activeElement;
    return !!a && !!a.closest('.app') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox' && Date.now() - lastTyped < 4000;
  }

  // Na het verwerken van wijzigingen de cursor terugzetten waar hij stond.
  function focusKey() {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    if (a.id) return { sel: '#' + CSS.escape(a.id) };
    const row = a.closest('[data-list]');
    if (row && a.dataset.field) return { sel: `[data-list="${row.dataset.list}"][data-id="${CSS.escape(row.dataset.id)}"] [data-field="${a.dataset.field}"]` };
    const form = a.closest('form[id]');
    if (form && a.name) return { sel: `#${form.id} [name="${a.name}"]` };
    return null;
  }

  function applyRemote(data, version) {
    const key = focusKey();
    state = merge(state, data);
    sync.version = version;
    takeSnap();
    saveLocal();
    saveSync();
    render();
    const el = key && $(key.sel);
    if (el && el !== document.activeElement) el.focus({ preventScroll: true });
    return canon(state) !== canon(sanitize(data)); // true = lokale wijzigingen moeten nog naar de server
  }

  function canon(s) {
    const del = {};
    Object.keys(s.deleted).sort().forEach((k) => { del[k] = s.deleted[k]; });
    return JSON.stringify([s.settings, s.setupDone, del, ...LISTS.map((l) => s[l])]);
  }

  async function syncNow() {
    if (!sync.code || !SYNC_ENABLED) return;
    if (busy) { again = true; return; }
    busy = true;
    renderSync('bezig');
    try {
      const got = await api('GET', null, '?action=get&code=' + encodeURIComponent(sync.code));
      if (got.status === 404) {
        unlink();
        render();
        await dialog('De gedeelde planning bestaat niet meer (verwijderd door jullie zelf of na 18 maanden zonder wijzigingen). Je planning op dit apparaat blijft gewoon bewaard.');
        return;
      }
      if (got.status !== 200) throw new Error('get');
      if (got.body.version !== sync.version) {
        if (userIsEditing()) { setTimeout(syncNow, 3000); return; }
        if (applyRemote(got.body.data, got.body.version)) sync.dirty = true;
      }
      for (let i = 0; sync.dirty && i < 3; i++) {
        const res = await api('POST', { action: 'save', code: sync.code, version: sync.version, data: state });
        if (res.status === 200) { sync.version = res.body.version; sync.dirty = false; }
        else if (res.status === 409) { applyRemote(res.body.data, res.body.version); }
        else throw new Error('save');
      }
      saveSync();
      lastSynced = new Date();
      syncError = '';
    } catch (e) {
      syncError = 'Geen verbinding. Wijzigingen worden verstuurd zodra je weer online bent.';
    } finally {
      busy = false;
      renderSync();
      if (again) { again = false; syncNow(); }
    }
  }

  function unlink() {
    sync = { code: '', version: 0, dirty: false };
    saveSync();
    renderSync();
  }

  function renderSync(mode) {
    const card = $('#sync-card');
    if (!SYNC_ENABLED) { card.hidden = true; return; }
    const linked = !!sync.code;
    $('#sync-on').hidden = !linked;
    $('#sync-off').hidden = linked || !syncAvailable;
    $('#sync-unavailable').hidden = linked || syncAvailable;
    $('#sync-badge').hidden = !linked;
    if (!linked) return;
    $('#sync-code').textContent = formatCode(sync.code);
    const status = $('#sync-status');
    status.classList.toggle('warn', !!syncError);
    status.textContent = syncError
      || (mode === 'bezig' || sync.dirty ? 'Bezig met synchroniseren…'
        : lastSynced ? `Gesynchroniseerd om ${lastSynced.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : 'Gekoppeld');
  }

  $('#sync-create').addEventListener('click', async () => {
    const btn = $('#sync-create');
    btn.disabled = true;
    try {
      stamp();
      const res = await api('POST', { action: 'create', data: state });
      if (res.status === 429) throw new Error('Er zijn te veel koppelcodes aangemaakt. Probeer het over een uur opnieuw.');
      if (res.status !== 201) throw new Error('Het maken van een koppelcode is niet gelukt. Probeer het later opnieuw.');
      sync = { code: res.body.code, version: res.body.version, dirty: false };
      lastSynced = new Date();
      saveSync();
      renderSync();
      await dialog(`Jullie koppelcode is ${formatCode(sync.code)}. Vul deze code op het apparaat van je partner in bij Instellingen → Samen plannen.`);
    } catch (e) {
      await dialog(e.message || 'Het maken van een koppelcode is niet gelukt.');
    } finally {
      btn.disabled = false;
    }
  });

  $('#sync-join').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = e.target.elements.code.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (code.length !== 12) { await dialog('Een koppelcode bestaat uit 12 tekens, bijvoorbeeld K7QM-4XPA-9RTE.'); return; }
    let res;
    try { res = await api('GET', null, '?action=get&code=' + encodeURIComponent(code)); } catch (err) {
      await dialog('Geen verbinding. Controleer je internet en probeer het opnieuw.');
      return;
    }
    if (res.status === 404) { await dialog('Deze koppelcode is niet gevonden. Controleer de code en probeer het opnieuw.'); return; }
    if (res.status === 429) { await dialog('Te veel pogingen. Probeer het over een uur opnieuw.'); return; }
    if (res.status !== 200) { await dialog('Koppelen is niet gelukt. Probeer het later opnieuw.'); return; }
    if (state.setupDone && !(await dialog('De planning op dit apparaat wordt vervangen door de gedeelde planning. Doorgaan?', { ok: 'Koppelen', cancel: 'Annuleren' }))) return;
    state = sanitize(res.body.data);
    takeSnap();
    saveLocal();
    sync = { code, version: res.body.version, dirty: false };
    lastSynced = new Date();
    saveSync();
    e.target.reset();
    render();
    showTab('overzicht');
  });

  $('#sync-copy').addEventListener('click', async () => {
    const text = formatCode(sync.code);
    try { await navigator.clipboard.writeText(text); $('#sync-copy').textContent = 'Gekopieerd'; }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents($('#sync-code'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    }
    setTimeout(() => { $('#sync-copy').textContent = 'Code kopiëren'; }, 2000);
  });

  $('#sync-unlink').addEventListener('click', async () => {
    if (!(await dialog('Dit apparaat stopt met synchroniseren. Je planning blijft op dit apparaat staan en de gedeelde planning blijft bestaan voor je partner.', { ok: 'Ontkoppelen', cancel: 'Annuleren' }))) return;
    unlink();
  });

  $('#sync-delete').addEventListener('click', async () => {
    if (!(await dialog('De gedeelde planning wordt definitief van de server verwijderd. Op dit apparaat blijft je planning staan; je partner kan niet meer synchroniseren.', { ok: 'Verwijderen', cancel: 'Annuleren', danger: true }))) return;
    try {
      const res = await api('POST', { action: 'delete', code: sync.code });
      if (res.status !== 200 && res.status !== 404) throw new Error();
      unlink();
      await dialog('De gedeelde planning is van de server verwijderd.');
    } catch (e) {
      await dialog('Verwijderen is niet gelukt. Controleer je verbinding en probeer het opnieuw.');
    }
  });

  async function initSync() {
    if (!SYNC_ENABLED) { renderSync(); return; }
    try {
      const res = await api('GET', null, '?action=ping');
      syncAvailable = res.status === 200 && res.body.ok === true;
    } catch (e) { syncAvailable = false; }
    renderSync();
    if (sync.code) syncNow();
    setInterval(() => { if (sync.code && document.visibilityState === 'visible') syncNow(); }, 15000);
    document.addEventListener('visibilitychange', () => { if (sync.code && document.visibilityState === 'visible') syncNow(); });
    window.addEventListener('online', () => { if (sync.code) syncNow(); });
  }

  /* ---------- Render ---------- */
  function render(keep) {
    renderHeader();
    renderOverview();
    renderChecklist();
    if (keep === 'budget') renderBudgetSummary(); else renderBudget();
    if (keep === 'guests') renderGuestSummary(); else renderGuests();
    renderSeating(keep === 'tables');
    if (keep !== 'schedule') renderSchedule();
    if (keep !== 'vendors') renderVendors();
    if (!userIsEditing()) fillSettingsForm();
    renderSync();
  }

  /* ---------- Getekende pampas en bladeren ---------- */
  function drawBotanicals() {
    $$('svg[data-bot]').forEach((svg) => {
      const count = parseInt(svg.dataset.bot, 10) || 2;
      let html = '';
      for (let k = 0; k < count; k++) {
        const x0 = 70 + k * 42, top = 40 + k * 46, lean = (k % 2 ? -1 : 1) * (18 + k * 6);
        const cx = x0 + lean * .5, cy = (420 + top) / 2, x1 = x0 + lean;
        const pt = (t) => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) * (1 - t) * 420 + 2 * (1 - t) * t * cy + t * t * top];
        let plume = '';
        for (let t = .5; t <= 1.001; t += .022) {
          const [px, py] = pt(t);
          const len = 10 + 26 * Math.sin(Math.PI * (t - .5) / .5 * .92 + .1);
          [-1, 1].forEach((side) => {
            const ex = px + side * len * .8, ey = py - len * .75;
            plume += `M${px.toFixed(1)} ${py.toFixed(1)}Q${(px + side * len * .2).toFixed(1)} ${(py - len * .6).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
          });
        }
        let leaves = '';
        [.18, .32].forEach((t, i) => {
          const [px, py] = pt(t), side = (i + k) % 2 ? -1 : 1, L = 46 - i * 8;
          leaves += `<path class="blad" d="M${px.toFixed(1)} ${py.toFixed(1)}q${side * L * .35} ${-L * .55} ${side * L} ${-L * .55}q${-side * L * .45} ${L * .25} ${-side * L} ${L * .55}z"/>`;
        });
        html += `<g class="wieg w${(k % 3) + 1}"><path class="steel" d="M${x0} 420Q${cx} ${cy} ${x1} ${top}"/><path class="pluim" d="${plume}"/>${leaves}</g>`;
      }
      svg.innerHTML = html;
    });
  }
  drawBotanicals();

  // Vervaging rechts van de tabbladen alleen tonen als er nog meer te zien is.
  const tabsEl = $('.tabs');
  const tabFade = () => tabsEl.classList.toggle('eind', tabsEl.scrollLeft + tabsEl.clientWidth >= tabsEl.scrollWidth - 4);
  tabsEl.addEventListener('scroll', tabFade, { passive: true });
  window.addEventListener('resize', tabFade);
  tabFade();
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })));

  render();
  let startTab = 'overzicht';
  try { startTab = sessionStorage.getItem(STORAGE_KEY + '.tab') || startTab; } catch (e) { /* ignore */ }
  showTab($('#tab-' + startTab) ? startTab : 'overzicht');
  setInterval(renderCountdown, 30000);
  initSync();
})();
