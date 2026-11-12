(() => {
  'use strict';

  const STORAGE_KEY = 'bruiloftsplanner.v1';

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

  const VENDOR_STATUS = ['Oriënteren', 'Offerte aangevraagd', 'Geboekt', 'Betaald'];
  const RSVP = { open: 'Nog geen reactie', ja: 'Komt', nee: 'Komt niet' };

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const euro = (n) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

  function freshState() {
    return {
      settings: { partner1: '', partner2: '', date: '', budget: 0, venue: '' },
      tasks: Object.entries(DEFAULT_TASKS).flatMap(([phase, list]) => list.map((title) => ({ id: uid(), title, phase, done: false }))),
      budget: DEFAULT_BUDGET.map(([name]) => ({ id: uid(), name, planned: 0, actual: 0, paid: 0, share: null })),
      guests: [],
      vendors: [],
      setupDone: false,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitize(JSON.parse(raw));
    } catch (e) { /* storage unavailable or corrupt */ }
    return freshState();
  }

  function sanitize(d) {
    const base = freshState();
    if (!d || typeof d !== 'object') return base;
    return {
      settings: { ...base.settings, ...(d.settings || {}) },
      tasks: Array.isArray(d.tasks) ? d.tasks : base.tasks,
      budget: Array.isArray(d.budget) ? d.budget : base.budget,
      guests: Array.isArray(d.guests) ? d.guests : [],
      vendors: Array.isArray(d.vendors) ? d.vendors : [],
      setupDone: !!d.setupDone,
    };
  }

  let state = load();
  const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };
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
    $('#couple-title').textContent = partner1 && partner2 ? `${partner1} & ${partner2}` : 'Ons trouwplan';
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
    if (diff <= 0 && diff > -86400000) { el.innerHTML = '<span class="message">Vandaag is de grote dag! 💍</span>'; return; }
    if (diff <= 0) { el.innerHTML = '<span class="message">Getrouwd! Gefeliciteerd 🥂</span>'; return; }
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

    // upcoming: open tasks from the current phase and earlier (overdue first), max 6
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
    return `<li class="${t.done ? 'done' : ''}" data-id="${t.id}">
      <input type="checkbox" data-action="toggle-task" ${t.done ? 'checked' : ''} aria-label="Afvinken: ${esc(t.title)}">
      <span class="title">${esc(t.title)}</span>
      ${showPhase && phase ? `<span class="phase-tag">${esc(phase.label)}</span>` : ''}
      ${showPhase ? '' : '<button class="icon-btn" data-action="delete-task" title="Verwijderen" aria-label="Taak verwijderen">×</button>'}
    </li>`;
  }

  function renderChecklist() {
    $('#task-phase').innerHTML = PHASES.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
    $('#task-phase').value = PHASES[currentPhaseIndex()].id;
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

  document.addEventListener('change', (e) => {
    if (e.target.dataset.action !== 'toggle-task') return;
    const t = state.tasks.find((x) => x.id === e.target.closest('li').dataset.id);
    if (t) { t.done = e.target.checked; commit(); }
  });

  /* ---------- Budget ---------- */
  function renderBudget() {
    renderBudgetSummary();
    const field = (b, k) => `<td class="num"><input type="number" min="0" step="10" value="${num(b[k]) || ''}" placeholder="0" data-field="${k}" aria-label="${k} ${esc(b.name)}"></td>`;
    $('#budget-rows').innerHTML = state.budget.length
      ? state.budget.map((b) => `<tr data-id="${b.id}" data-list="budget">
          <td><input value="${esc(b.name)}" data-field="name" aria-label="Naam post"></td>
          ${field(b, 'planned')}${field(b, 'actual')}${field(b, 'paid')}
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
    // Only fill planned amounts for default posts that are still empty
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
      const c = Math.max(1, num(g.count));
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
      ? list.map((g) => `<tr data-id="${g.id}" data-list="guests">
          <td><input value="${esc(g.name)}" data-field="name" aria-label="Naam"></td>
          <td class="num"><input type="number" min="1" value="${Math.max(1, num(g.count))}" data-field="count" aria-label="Aantal personen" style="min-width:60px"></td>
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
    state.guests.push({ id: uid(), name, count: Math.max(1, num(f.elements.count.value)), type: f.elements.type.value, rsvp: 'open', note: '' });
    f.elements.name.value = '';
    f.elements.count.value = 1;
    commit();
    f.elements.name.focus();
  });
  $('#guest-search').addEventListener('input', renderGuests);

  /* ---------- Vendors ---------- */
  function renderVendors() {
    $('#vendor-rows').innerHTML = state.vendors.length
      ? state.vendors.map((v) => `<tr data-id="${v.id}" data-list="vendors">
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

  /* ---------- Inline table editing (budget / guests / vendors) ---------- */
  const NUMERIC = new Set(['planned', 'actual', 'paid', 'count']);
  document.addEventListener('change', (e) => {
    const field = e.target.dataset.field;
    const row = e.target.closest('tr[data-list]');
    if (!field || !row) return;
    const item = state[row.dataset.list].find((x) => x.id === row.dataset.id);
    if (!item) return;
    item[field] = NUMERIC.has(field) ? num(e.target.value) : e.target.value.trim();
    if (field === 'rsvp') e.target.className = 'status-' + item.rsvp;
    save();
    render(row.dataset.list); // keep the table being edited intact so focus is not lost
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'delete-row') {
      const row = btn.closest('tr[data-list]');
      state[row.dataset.list] = state[row.dataset.list].filter((x) => x.id !== row.dataset.id);
      commit();
    } else if (btn.dataset.action === 'delete-task') {
      const id = btn.closest('li').dataset.id;
      state.tasks = state.tasks.filter((t) => t.id !== id);
      commit();
    }
  });

  /* ---------- Settings ---------- */
  function applySettings(form) {
    const prevBudget = num(state.settings.budget);
    state.settings = {
      partner1: form.elements.partner1.value.trim(),
      partner2: form.elements.partner2.value.trim(),
      date: form.elements.date.value,
      budget: num(form.elements.budget.value),
      venue: form.elements.venue ? form.elements.venue.value.trim() : state.settings.venue,
    };
    if (state.settings.budget && state.settings.budget !== prevBudget) distributeBudget(state.settings.budget);
  }

  function fillSettingsForm() {
    const f = $('#settings-form').elements;
    const s = state.settings;
    f.partner1.value = s.partner1; f.partner2.value = s.partner2;
    f.date.value = s.date; f.budget.value = s.budget || ''; f.venue.value = s.venue || '';
  }

  $('#welcome-form').addEventListener('submit', (e) => {
    e.preventDefault();
    applySettings(e.target);
    state.setupDone = true;
    commit();
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
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!confirm('De huidige planning wordt vervangen door de back-up. Doorgaan?')) return;
        state = sanitize(data);
        commit();
        alert('Back-up teruggezet.');
      } catch (err) {
        alert('Dit bestand kon niet worden gelezen. Kies een back-up van de bruiloftsplanner (.json).');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  });

  $('#print-btn').addEventListener('click', () => window.print());

  $('#reset-btn').addEventListener('click', () => {
    if (!confirm('Weet je zeker dat je alle gegevens wilt wissen? Dit kan niet ongedaan worden gemaakt.')) return;
    state = freshState();
    commit();
    showTab('overzicht');
  });

  /* ---------- Render ---------- */
  function render(keepTable) {
    renderHeader();
    renderOverview();
    renderChecklist();
    if (keepTable === 'budget') renderBudgetSummary(); else renderBudget();
    if (keepTable === 'guests') renderGuestSummary(); else renderGuests();
    if (keepTable !== 'vendors') renderVendors();
    fillSettingsForm();
  }

  render();
  let startTab = 'overzicht';
  try { startTab = sessionStorage.getItem(STORAGE_KEY + '.tab') || startTab; } catch (e) { /* ignore */ }
  showTab($('#tab-' + startTab) ? startTab : 'overzicht');
  setInterval(renderCountdown, 30000);
})();
