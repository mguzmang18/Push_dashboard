(() => {
  'use strict';

  const state = {
    all: [],
    filtered: [],
    filters: { app: '', flow: '', from: '', to: '' },
    comments: { search: '', negativeOnly: false, sortKey: 'date', sortDir: 'desc', page: 1, pageSize: 25 },
    charts: {},
  };

  const MONTH_FMT = new Intl.DateTimeFormat('es', { month: 'short', year: 'numeric' });
  const SCORE_COLORS = { 1: '#d64545', 2: '#e08a3e', 3: '#e0b93e', 4: '#7bc98f', 5: '#1c9d6b' };

  async function init() {
    const res = await fetch('data/push_data.json');
    const raw = await res.json();
    state.all = raw
      .filter(r => r.score !== null && r.date)
      .map(r => ({ ...r, dateObj: new Date(r.date) }));

    populateFilterOptions();
    bindEvents();
    applyFilters();
  }

  function populateFilterOptions() {
    const apps = [...new Set(state.all.map(r => r.app))].sort();
    const flows = [...new Set(state.all.map(r => r.flow))].sort();

    const appSel = document.getElementById('f-app');
    apps.forEach(a => appSel.appendChild(new Option(a, a)));

    const flowSel = document.getElementById('f-flow');
    flows.forEach(f => flowSel.appendChild(new Option(f, f)));
  }

  function bindEvents() {
    document.getElementById('f-app').addEventListener('change', e => { state.filters.app = e.target.value; applyFilters(); });
    document.getElementById('f-flow').addEventListener('change', e => { state.filters.flow = e.target.value; applyFilters(); });
    document.getElementById('f-from').addEventListener('change', e => { state.filters.from = e.target.value; applyFilters(); });
    document.getElementById('f-to').addEventListener('change', e => { state.filters.to = e.target.value; applyFilters(); });
    document.getElementById('f-reset').addEventListener('click', () => {
      state.filters = { app: '', flow: '', from: '', to: '' };
      document.getElementById('f-app').value = '';
      document.getElementById('f-flow').value = '';
      document.getElementById('f-from').value = '';
      document.getElementById('f-to').value = '';
      applyFilters();
    });

    document.getElementById('c-search').addEventListener('input', e => {
      state.comments.search = e.target.value.toLowerCase();
      state.comments.page = 1;
      renderComments();
    });
    document.getElementById('c-negative-only').addEventListener('change', e => {
      state.comments.negativeOnly = e.target.checked;
      state.comments.page = 1;
      renderComments();
    });
    document.getElementById('c-prev').addEventListener('click', () => {
      if (state.comments.page > 1) { state.comments.page--; renderComments(); }
    });
    document.getElementById('c-next').addEventListener('click', () => {
      state.comments.page++; renderComments();
    });
    document.querySelectorAll('#comments-table thead th').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (state.comments.sortKey === key) {
          state.comments.sortDir = state.comments.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.comments.sortKey = key;
          state.comments.sortDir = 'asc';
        }
        renderComments();
      });
    });
  }

  function applyFilters() {
    const { app, flow, from, to } = state.filters;
    const fromDate = from ? new Date(from + 'T00:00:00') : null;
    const toDate = to ? new Date(to + 'T23:59:59') : null;

    state.filtered = state.all.filter(r => {
      if (app && r.app !== app) return false;
      if (flow && r.flow !== flow) return false;
      if (fromDate && r.dateObj < fromDate) return false;
      if (toDate && r.dateObj > toDate) return false;
      return true;
    });

    renderKpis();
    renderTrendChart();
    renderScoreChart();
    renderAppChart();
    renderFlowChart();
    state.comments.page = 1;
    renderComments();
  }

  function renderKpis() {
    const data = state.filtered;
    const total = data.length;
    const avg = total ? data.reduce((s, r) => s + r.score, 0) / total : 0;
    const good = data.filter(r => r.score >= 4).length;
    const bad = data.filter(r => r.score <= 2).length;

    document.getElementById('kpi-total').textContent = total.toLocaleString('es');
    document.getElementById('kpi-avg').textContent = total ? avg.toFixed(2) : '–';
    document.getElementById('kpi-good').textContent = total ? `${((good / total) * 100).toFixed(1)}%` : '–';
    document.getElementById('kpi-bad').textContent = total ? `${((bad / total) * 100).toFixed(1)}%` : '–';
  }

  function destroyChart(key) {
    if (state.charts[key]) { state.charts[key].destroy(); delete state.charts[key]; }
  }

  function renderTrendChart() {
    const buckets = new Map();
    state.filtered.forEach(r => {
      const key = `${r.dateObj.getFullYear()}-${String(r.dateObj.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets.has(key)) buckets.set(key, { sum: 0, count: 0, date: r.dateObj });
      const b = buckets.get(key);
      b.sum += r.score;
      b.count += 1;
    });
    const keys = [...buckets.keys()].sort();
    const labels = keys.map(k => MONTH_FMT.format(buckets.get(k).date));
    const avgSeries = keys.map(k => (buckets.get(k).sum / buckets.get(k).count));
    const volSeries = keys.map(k => buckets.get(k).count);

    destroyChart('trend');
    const ctx = document.getElementById('chart-trend');
    state.charts.trend = new Chart(ctx, {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Respuestas',
            data: volSeries,
            backgroundColor: 'rgba(79, 109, 245, 0.35)',
            yAxisID: 'y1',
            order: 2,
          },
          {
            type: 'line',
            label: 'Score promedio',
            data: avgSeries,
            borderColor: '#1c9d6b',
            backgroundColor: '#1c9d6b',
            tension: 0.3,
            yAxisID: 'y2',
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y1: { position: 'left', title: { display: true, text: 'Respuestas' }, beginAtZero: true },
          y2: { position: 'right', title: { display: true, text: 'Score' }, min: 1, max: 5, grid: { drawOnChartArea: false } },
        },
      },
    });
  }

  function renderScoreChart() {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    state.filtered.forEach(r => { if (counts[r.score] !== undefined) counts[r.score]++; });

    destroyChart('score');
    const ctx = document.getElementById('chart-score');
    state.charts.score = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['1', '2', '3', '4', '5'],
        datasets: [{
          label: 'Respuestas',
          data: [1, 2, 3, 4, 5].map(s => counts[s]),
          backgroundColor: [1, 2, 3, 4, 5].map(s => SCORE_COLORS[s]),
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  function renderAppChart() {
    const byApp = new Map();
    state.filtered.forEach(r => {
      if (!byApp.has(r.app)) byApp.set(r.app, { sum: 0, count: 0 });
      const b = byApp.get(r.app);
      b.sum += r.score;
      b.count += 1;
    });
    const apps = [...byApp.keys()].sort();

    destroyChart('app');
    const ctx = document.getElementById('chart-app');
    state.charts.app = new Chart(ctx, {
      data: {
        labels: apps,
        datasets: [
          {
            type: 'bar',
            label: 'Respuestas',
            data: apps.map(a => byApp.get(a).count),
            backgroundColor: 'rgba(79, 109, 245, 0.35)',
            yAxisID: 'y1',
          },
          {
            type: 'line',
            label: 'Score promedio',
            data: apps.map(a => byApp.get(a).sum / byApp.get(a).count),
            borderColor: '#1c9d6b',
            backgroundColor: '#1c9d6b',
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y1: { position: 'left', title: { display: true, text: 'Respuestas' }, beginAtZero: true },
          y2: { position: 'right', title: { display: true, text: 'Score' }, min: 1, max: 5, grid: { drawOnChartArea: false } },
        },
      },
    });
  }

  function renderFlowChart() {
    const byFlow = new Map();
    state.filtered.forEach(r => {
      if (!byFlow.has(r.flow)) byFlow.set(r.flow, { sum: 0, count: 0 });
      const b = byFlow.get(r.flow);
      b.sum += r.score;
      b.count += 1;
    });
    const flows = [...byFlow.keys()].sort((a, b) => byFlow.get(b).count - byFlow.get(a).count);

    destroyChart('flow');
    const ctx = document.getElementById('chart-flow');
    state.charts.flow = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: flows,
        datasets: [{
          label: 'Respuestas',
          data: flows.map(f => byFlow.get(f).count),
          backgroundColor: 'rgba(79, 109, 245, 0.55)',
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } },
      },
    });
  }

  function renderComments() {
    const { search, negativeOnly, sortKey, sortDir, page, pageSize } = state.comments;

    let rows = state.filtered.filter(r => r.msg);
    if (negativeOnly) rows = rows.filter(r => r.score <= 2);
    if (search) rows = rows.filter(r => r.msg.toLowerCase().includes(search));

    rows = rows.slice().sort((a, b) => {
      let av = a[sortKey === 'date' ? 'dateObj' : sortKey];
      let bv = b[sortKey === 'date' ? 'dateObj' : sortKey];
      if (av === undefined || av === null) av = '';
      if (bv === undefined || bv === null) bv = '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    if (state.comments.page > totalPages) state.comments.page = totalPages;
    const start = (state.comments.page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    const tbody = document.getElementById('comments-tbody');
    tbody.innerHTML = pageRows.map(r => `
      <tr>
        <td>${formatDate(r.dateObj)}</td>
        <td>${escapeHtml(r.app)}</td>
        <td>${escapeHtml(r.flow)}</td>
        <td><span class="score-pill score-${r.score}">${r.score}</span></td>
        <td class="msg-col">${escapeHtml(r.msg)}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">Sin resultados</td></tr>';

    document.getElementById('c-page-info').textContent = `Página ${state.comments.page} de ${totalPages} · ${rows.length.toLocaleString('es')} comentarios`;
    document.getElementById('c-prev').disabled = state.comments.page <= 1;
    document.getElementById('c-next').disabled = state.comments.page >= totalPages;
  }

  function formatDate(d) {
    return d.toLocaleString('es', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', init);
})();
