const CONVEX_SITE = 'https://exuberant-lapwing-294.convex.site';

// ── User routing ──
const USER_MAP = {
  pam:   '6285585111',
  bruce: 'bruce-entertainment',
  karen: 'karen-entertainment',
  lori:  'lori-entertainment',
};
const USER_NAMES = {
  pam:   'Entertainment Hub',
  bruce: "Bruce's Hub",
  karen: "Karen's Hub",
  lori:  "Lori's Hub",
};
const urlUser = (new URLSearchParams(location.search).get('user') || 'pam').toLowerCase();
const CURRENT_USER_ID   = USER_MAP[urlUser]   || '6285585111';
const CURRENT_USER_NAME = USER_NAMES[urlUser] || 'Entertainment Hub';

let allData = [];
let currentTab = 'tonight';
let currentSubFilter = {};
let searchQuery = '';

// ── API ──

async function apiGet(path) {
  const res = await fetch(CONVEX_SITE + path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(CONVEX_SITE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ── Helpers ──

function platformClass(p) {
  if (!p) return 'unknown';
  return p.toLowerCase().replace(/\s+/g, '-');
}

function renderStars(rating) {
  if (!rating) return '';
  let s = '';
  for (let i = 1; i <= 5; i++) {
    s += i <= rating ? '&#9733;' : '<span class="empty">&#9733;</span>';
  }
  return `<span class="stars">${s}</span>`;
}

function formatRuntime(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Data Loading ──

async function loadData() {
  try {
    const data = await apiGet(`/api/entertainment?userTelegramId=${encodeURIComponent(CURRENT_USER_ID)}`);
    allData = data || [];
    allData.sort((a, b) => {
      const sn = (a.series_name || '').localeCompare(b.series_name || '');
      if (sn !== 0) return sn;
      return (a.series_order || 0) - (b.series_order || 0);
    });
    renderTab(currentTab);
  } catch (err) {
    console.error('Failed to load:', err);
    document.getElementById('content').innerHTML = '<div class="loading">Failed to load data</div>';
  }
}

function getByType(type) {
  return allData.filter(d => d.media_type === type);
}

function getByStatus(items, status) {
  return items.filter(d => d.status === status);
}

function getSeriesGroups(items) {
  const groups = {};
  const standalone = [];
  items.forEach(item => {
    if (item.series_name) {
      if (!groups[item.series_name]) groups[item.series_name] = [];
      groups[item.series_name].push(item);
    } else {
      standalone.push(item);
    }
  });
  Object.values(groups).forEach(g => g.sort((a, b) => (a.series_order || 0) - (b.series_order || 0)));
  return { groups, standalone };
}

// ── Rendering ──

function renderSubFilters(filters, tab) {
  const active = currentSubFilter[tab] || filters[0].key;
  return `<div class="sub-filters" data-tab="${tab}">
    ${filters.map(f => `<button class="sub-filter-btn ${f.key === active ? 'active' : ''}" data-subfilter="${f.key}" data-tab="${tab}">${f.label}<span class="count">${f.count}</span></button>`).join('')}
  </div>`;
}

function bindSubFilters() {
  document.querySelectorAll('.sub-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      currentSubFilter[tab] = btn.dataset.subfilter;
      renderTab(tab);
    });
  });
}

function renderTab(tab) {
  currentTab = tab;
  const content = document.getElementById('content');

  if (searchQuery) {
    content.innerHTML = renderSearchResults(searchQuery);
  } else {
    switch (tab) {
      case 'tonight': content.innerHTML = renderTonight(); break;
      case 'series': content.innerHTML = renderSeriesTab(); break;
      case 'movies': content.innerHTML = renderMoviesTab(); break;
      case 'audiobooks': content.innerHTML = renderAudiobooksTab(); break;
      case 'stats': content.innerHTML = renderStatsTab(); break;
    }
  }

  bindCardClicks();
  bindCollapsibles();
  bindSeriesGroupToggles();
  bindSubFilters();
  if (tab === 'audiobooks') bindSearch();
}

// ── Currently Watching View ──

function renderTonight() {
  const screenItems = allData.filter(d => d.media_type === 'series' || d.media_type === 'movie' || d.media_type === 'limited_series');
  const inProgress = screenItems.filter(d => d.status === 'in_progress');

  let html = '';

  if (inProgress.length) {
    inProgress.forEach(d => { html += tonightCard(d, 'in_progress'); });
  } else {
    html += '<div class="empty-state">Nothing active right now. Start something from Series or Movies.</div>';
  }

  return html;
}

function tonightCard(d, context) {
  const series = d.series_name ? `${escapeHtml(d.series_name)}${d.series_order ? ' #' + d.series_order : ''}` : '';
  const position = d.current_position ? escapeHtml(d.current_position) : '';

  let actionBtn = '';
  if (context === 'in_progress') {
    actionBtn = `<span class="btn-inline watching-status">Watching</span>`;
  } else if (context === 'want') {
    actionBtn = `<button class="btn-inline start" onclick="event.stopPropagation();setStatus('${d.id}','in_progress')">Start Watching</button>`;
  } else if (context === 'waiting') {
    actionBtn = `<button class="btn-inline new-season" onclick="event.stopPropagation();setStatus('${d.id}','in_progress')">New Season!</button>`;
  }

  const isHero = context === 'in_progress';

  const poster = d.metadata?.posterUrl ? `<img class="card-poster" src="${escapeHtml(d.metadata.posterUrl)}" alt="" loading="lazy">` : `<div class="card-poster card-poster--empty"></div>`;
  return `<div class="${isHero ? 'hero-card' : 'card'}" data-id="${d.id}">
    <div class="card-inner">
      ${poster}
      <div class="card-body">
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(d.title)}</div>
            <div class="card-subtitle">${escapeHtml(d.creator || '')}</div>
            ${series ? `<div class="card-subtitle" style="font-size:0.75rem">${series}</div>` : ''}
            ${position ? `<div class="card-subtitle" style="font-size:0.75rem">${position}</div>` : ''}
          </div>
          <span class="status-dot ${d.status}"></span>
        </div>
        <div class="card-meta">
          <span class="platform-badge ${platformClass(d.platform)}">${escapeHtml(d.platform || 'Unknown')}</span>
          ${actionBtn}
        </div>
      </div>
    </div>
  </div>`;
}

function heroCard(d) {
  const narrator = d.metadata?.narrator ? `Narrated by ${escapeHtml(d.metadata.narrator)}` : '';
  const series = d.series_name ? `${escapeHtml(d.series_name)}${d.series_order ? ' #' + d.series_order : ''}` : '';
  const position = d.current_position ? `<div class="card-subtitle">${escapeHtml(d.current_position)}</div>` : '';
  const timesInfo = d.times_completed > 1 ? ` (Listen #${d.times_completed + 1})` : '';

  const poster = d.metadata?.posterUrl ? `<img class="card-poster" src="${escapeHtml(d.metadata.posterUrl)}" alt="" loading="lazy">` : `<div class="card-poster card-poster--empty"></div>`;
  return `<div class="hero-card" data-id="${d.id}">
    <div class="card-inner">
      ${poster}
      <div class="card-body">
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(d.title)}${timesInfo}</div>
            <div class="card-subtitle">${escapeHtml(d.creator)}${narrator ? ' &middot; ' + narrator : ''}</div>
            ${series ? `<div class="card-subtitle">${series}</div>` : ''}
            ${position}
          </div>
          <span class="status-dot ${d.status}"></span>
        </div>
        <div class="card-meta">
          <span class="platform-badge ${platformClass(d.platform)}">${escapeHtml(d.platform || 'Unknown')}</span>
          ${d.media_type !== d.platform?.toLowerCase() ? `<span style="font-size:0.7rem;color:var(--text-dim)">${d.media_type}</span>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function card(d, opts = {}) {
  const narrator = d.media_type === 'audiobook' && d.metadata?.narrator ? ` &middot; ${escapeHtml(d.metadata.narrator)}` : '';
  const series = d.series_name ? `${escapeHtml(d.series_name)}${d.series_order ? ' #' + d.series_order : ''}` : '';
  const style = opts.muted ? 'opacity:0.7' : '';

  const poster = d.metadata?.posterUrl ? `<img class="card-poster" src="${escapeHtml(d.metadata.posterUrl)}" alt="" loading="lazy">` : `<div class="card-poster card-poster--empty"></div>`;
  return `<div class="card" data-id="${d.id}" style="${style}">
    <div class="card-inner">
      ${poster}
      <div class="card-body">
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(d.title)}</div>
            <div class="card-subtitle">${escapeHtml(d.creator)}${narrator}</div>
            ${series ? `<div class="card-subtitle" style="font-size:0.75rem">${series}</div>` : ''}
            ${(() => {
              if (!d.notes) return '';
              const lines = d.notes.split('\n\n');
              const scoreLine = lines[0].startsWith('Scores:') ? lines[0].replace('Scores:', '').trim() : null;
              const overview = scoreLine ? lines.slice(1).join(' ').trim() : d.notes;
              return (scoreLine ? `<div class="card-score">${escapeHtml(scoreLine)}</div>` : '') +
                     (overview ? `<div class="card-subtitle" style="font-style:italic;font-size:0.75rem">${escapeHtml(overview)}</div>` : '');
            })()}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span class="status-dot ${d.status}"></span>
            ${d.rating ? renderStars(d.rating) : ''}
          </div>
        </div>
        <div class="card-meta">
          <span class="platform-badge ${platformClass(d.platform)}">${escapeHtml(d.platform || 'Unknown')}</span>
          ${d.genre ? `<span class="genre-tag">${escapeHtml(d.genre.split(',')[0].trim())}</span>` : ''}
          ${d.times_completed > 1 ? `<span style="font-size:0.7rem;color:var(--text-muted)">${d.times_completed}x</span>` : ''}
          ${d.metadata?.runtime_minutes ? `<span style="font-size:0.7rem;color:var(--text-dim)">${formatRuntime(d.metadata.runtime_minutes)}</span>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function renderQueueFlow(name, items) {
  let inner = '';
  items.forEach(d => {
    let cls = 'queue-item';
    if (d.status === 'completed') cls += ' done';
    else if (d.status === 'in_progress') cls += ' current';
    else cls += ' upcoming';

    inner += `<span class="${cls}" data-id="${d.id}">${escapeHtml(d.title)}</span>`;
    if (d !== items[items.length - 1]) inner += '<span class="queue-arrow">&#9654;</span>';
  });

  const platformsUsed = [...new Set(items.map(d => d.platform).filter(Boolean))];
  const platformBadges = platformsUsed.map(p => `<span class="platform-badge ${platformClass(p)}" style="font-size:0.6rem">${escapeHtml(p)}</span>`).join(' ');

  return `<div class="series-group">
    <div style="padding:12px 16px">
      <div class="series-group-title">${escapeHtml(name)}</div>
      <div style="margin-top:4px">${platformBadges}</div>
    </div>
    <div class="queue-flow">${inner}</div>
  </div>`;
}

// ── Series Tab ──

function renderSeriesTab() {
  const items = getByType('series');
  const limitedItems = getByType('limited_series');
  const inProgress = getByStatus(items, 'in_progress');
  const waiting = getByStatus(items, 'waiting');
  const paused = getByStatus(items, 'paused');
  const want = getByStatus(items, 'want');
  const completed = getByStatus(items, 'completed');

  const active = currentSubFilter['series'] || 'watching';

  let html = renderSubFilters([
    { key: 'watching', label: 'Currently Watching', count: inProgress.length },
    { key: 'caught_up', label: 'Caught Up', count: waiting.length },
    { key: 'want', label: 'Want to Watch', count: want.length },
    { key: 'limited', label: 'Limited Series', count: limitedItems.length },
    { key: 'paused', label: 'Paused', count: paused.length },
    { key: 'completed', label: 'Completed', count: completed.length },
  ], 'series');

  html += '<div class="sub-filter-content">';

  if (active === 'watching') {
    if (inProgress.length) {
      inProgress.forEach(d => { html += tonightCard(d, 'in_progress'); });
    } else {
      html += '<div class="empty-state">No series in progress.</div>';
    }
  } else if (active === 'caught_up') {
    if (waiting.length) {
      waiting.forEach(d => { html += tonightCard(d, 'waiting'); });
    } else {
      html += '<div class="empty-state">No series waiting for new seasons.</div>';
    }
  } else if (active === 'want') {
    if (want.length) {
      const { groups, standalone } = getSeriesGroups(want);
      Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, seriesItems]) => {
        const allInSeries = allData.filter(d => d.series_name === name).sort((a, b) => (a.series_order || 0) - (b.series_order || 0));
        html += renderSeriesGroup(name, allInSeries);
      });
      standalone.forEach(d => { html += tonightCard(d, 'want'); });
    } else {
      html += '<div class="empty-state">Nothing in the queue.</div>';
    }
  } else if (active === 'limited') {
    if (limitedItems.length) {
      const wantLimited = getByStatus(limitedItems, 'want');
      const progressLimited = getByStatus(limitedItems, 'in_progress');
      const doneLimited = getByStatus(limitedItems, 'completed');
      [...progressLimited, ...wantLimited, ...doneLimited].forEach(d => { html += tonightCard(d, d.status); });
    } else {
      html += '<div class="empty-state">No limited series yet. Add some!</div>';
    }
  } else if (active === 'paused') {
    if (paused.length) {
      paused.forEach(d => { html += card(d, { muted: true }); });
    } else {
      html += '<div class="empty-state">No paused series.</div>';
    }
  } else if (active === 'completed') {
    if (completed.length) {
      completed.sort((a, b) => (b.rating || 0) - (a.rating || 0)).forEach(d => { html += card(d); });
    } else {
      html += '<div class="empty-state">No completed series.</div>';
    }
  }

  html += '</div>';
  return html;
}

// ── Movies Tab ──

function renderMoviesTab() {
  const items = getByType('movie');
  const want = items.filter(d => d.status === 'want');
  const watched = items.filter(d => d.status === 'completed');

  const active = currentSubFilter['movies'] || 'want';

  let html = renderSubFilters([
    { key: 'want', label: 'Want to Watch', count: want.length },
    { key: 'watched', label: 'Watched', count: watched.length },
  ], 'movies');

  html += '<div class="sub-filter-content">';

  if (active === 'want') {
    if (want.length) {
      const { groups, standalone } = getSeriesGroups(want);
      Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, franchiseItems]) => {
        const allInFranchise = allData.filter(d => d.series_name === name && d.media_type === 'movie').sort((a, b) => (a.series_order || 0) - (b.series_order || 0));
        html += renderSeriesGroup(name, allInFranchise);
      });
      standalone.forEach(d => { html += tonightCard(d, 'want'); });
    } else {
      html += '<div class="empty-state">No movies in the queue.</div>';
    }
  } else if (active === 'watched') {
    if (watched.length) {
      const { groups, standalone } = getSeriesGroups(watched);
      Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, franchiseItems]) => {
        const allInFranchise = allData.filter(d => d.series_name === name && d.media_type === 'movie').sort((a, b) => (a.series_order || 0) - (b.series_order || 0));
        html += renderSeriesGroup(name, allInFranchise);
      });
      standalone.sort((a, b) => (b.rating || 0) - (a.rating || 0)).forEach(d => { html += card(d); });
    } else {
      html += '<div class="empty-state">No watched movies.</div>';
    }
  }

  html += '</div>';
  return html;
}

// ── Audiobooks Tab ──

function renderAudiobooksTab() {
  const items = getByType('audiobook');
  const { groups, standalone } = getSeriesGroups(items);

  let html = '';

  html += `<div class="search-bar">
    <input type="text" class="search-input" id="audiobook-search" placeholder="Search titles, authors, narrators, series...">
    <div class="filter-row">
      <button class="filter-btn active" data-filter="all">All</button>
      <button class="filter-btn" data-filter="in_progress">In Progress</button>
      <button class="filter-btn" data-filter="completed">Completed</button>
      <button class="filter-btn" data-filter="series">Series Only</button>
      <button class="filter-btn" data-filter="standalone">Standalone</button>
    </div>
  </div>`;

  html += '<div id="audiobook-list">';
  html += renderAudiobookList(groups, standalone, items);
  html += '</div>';

  return html;
}

function renderAudiobookList(groups, standalone, allAudiobooks) {
  let html = '';

  const completed = allAudiobooks.filter(d => d.status === 'completed').length;
  const inProg = allAudiobooks.filter(d => d.status === 'in_progress').length;
  html += `<div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:16px">
    ${allAudiobooks.length} audiobooks &middot; ${Object.keys(groups).length} series &middot; ${completed} completed &middot; ${inProg} in progress
  </div>`;

  const sortedSeries = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  if (sortedSeries.length) {
    html += sectionTitle('Series', sortedSeries.length);
    sortedSeries.forEach(([name, items]) => {
      html += renderSeriesGroup(name, items);
    });
  }

  if (standalone.length) {
    html += sectionTitle('Standalone', standalone.length);
    standalone.sort((a, b) => a.title.localeCompare(b.title)).forEach(d => { html += card(d); });
  }

  return html;
}

function renderSeriesGroup(name, items) {
  const done = items.filter(d => d.status === 'completed').length;
  const total = items.length;
  const creator = items[0]?.creator || '';
  const narrator = items[0]?.metadata?.narrator || '';

  let pips = '';
  items.forEach(d => {
    let cls = 'pip';
    if (d.status === 'completed') cls += ' done';
    else if (d.status === 'in_progress') cls += ' active';
    pips += `<div class="${cls}"></div>`;
  });

  let itemsHtml = '';
  items.forEach(d => {
    const isActive = d.status === 'in_progress';
    const isDone = d.status === 'completed';
    const cls = isDone ? 'dimmed' : (isActive ? 'active-item' : '');
    const check = isDone ? '<span class="series-item-check">&#10003;</span>' : (isActive ? '<span class="status-dot in_progress"></span>' : '');
    const num = d.series_order || '';
    const runtime = d.metadata?.runtime_minutes ? formatRuntime(d.metadata.runtime_minutes) : '';
    const times = d.times_completed > 1 ? ` (${d.times_completed}x)` : '';

    itemsHtml += `<div class="series-item ${cls}" data-id="${d.id}">
      <span class="series-item-num">${num}</span>
      <span class="series-item-title">${escapeHtml(d.title)}${times}</span>
      ${runtime ? `<span style="font-size:0.7rem;color:var(--text-dim)">${runtime}</span>` : ''}
      ${check}
    </div>`;
  });

  return `<div class="series-group" data-series="${escapeHtml(name)}">
    <div class="series-group-header" data-toggle-series>
      <div>
        <div class="series-group-title">${escapeHtml(name)}</div>
        <div class="series-group-meta">${escapeHtml(creator)}${narrator ? ' &middot; ' + escapeHtml(narrator) : ''} &middot; ${done}/${total} completed</div>
      </div>
      <div class="series-group-progress">${pips}</div>
    </div>
    <div class="series-group-items" style="display:none">${itemsHtml}</div>
  </div>`;
}

// ── Detail View ──

async function showDetail(id) {
  const item = allData.find(d => d.id === id);
  if (!item) return;

  const narrator = item.metadata?.narrator || '';
  const runtime = item.metadata?.runtime_minutes ? formatRuntime(item.metadata.runtime_minutes) : '';
  const series = item.series_name || '';
  const seriesItems = series ? allData.filter(d => d.series_name === series).sort((a, b) => (a.series_order || 0) - (b.series_order || 0)) : [];
  const seriesPos = series && item.series_order ? `Book ${item.series_order} of ${seriesItems.length}` : '';

  let html = `
    <div class="detail-header">
      ${item.metadata?.posterUrl ? `<img class="detail-poster" src="${escapeHtml(item.metadata.posterUrl)}" alt="${escapeHtml(item.title)}">` : ''}
      <div class="detail-header-text">
        <div class="detail-title">${escapeHtml(item.title)}</div>
        <div class="detail-creator">${escapeHtml(item.creator)}</div>
      </div>
    </div>

    <div class="detail-row">
      <span class="detail-label">Status</span>
      <span class="detail-value"><span class="status-label ${item.status}">${item.status.replace('_', ' ')}</span></span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Platform</span>
      <span class="detail-value"><span class="platform-badge ${platformClass(item.platform)}">${escapeHtml(item.platform || 'Unknown')}</span></span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Type</span>
      <span class="detail-value">${item.media_type}</span>
    </div>
    ${series ? `<div class="detail-row"><span class="detail-label">Series</span><span class="detail-value">${escapeHtml(series)}${seriesPos ? ' &middot; ' + seriesPos : ''}</span></div>` : ''}
    ${narrator ? `<div class="detail-row"><span class="detail-label">Narrator</span><span class="detail-value">${escapeHtml(narrator)}</span></div>` : ''}
    ${runtime ? `<div class="detail-row"><span class="detail-label">Runtime</span><span class="detail-value">${runtime}</span></div>` : ''}
    ${item.genre ? `<div class="detail-row"><span class="detail-label">Genre</span><span class="detail-value">${escapeHtml(item.genre)}</span></div>` : ''}
    ${item.rating ? `<div class="detail-row"><span class="detail-label">Rating</span><span class="detail-value">${renderStars(item.rating)}</span></div>` : ''}
    ${item.times_completed ? `<div class="detail-row"><span class="detail-label">Times Completed</span><span class="detail-value">${item.times_completed}</span></div>` : ''}
    ${item.current_position ? `<div class="detail-row"><span class="detail-label">Position</span><span class="detail-value">${escapeHtml(item.current_position)}</span></div>` : ''}
    ${item.notes ? `<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value" style="text-align:left;max-width:60%">${escapeHtml(item.notes)}</span></div>` : ''}
    ${item.tags?.length ? `<div class="detail-row"><span class="detail-label">Tags</span><span class="detail-value">${item.tags.map(t => escapeHtml(t)).join(', ')}</span></div>` : ''}
  `;

  if (seriesItems.length > 1) {
    html += `<div style="margin-top:16px"><div class="section-title">Series: ${escapeHtml(series)}</div>`;
    seriesItems.forEach(si => {
      const isCurrent = si.id === item.id;
      const isDone = si.status === 'completed';
      html += `<div class="series-item ${isDone ? 'dimmed' : ''} ${isCurrent ? 'active-item' : ''}" data-id="${si.id}" style="${isCurrent ? 'background:rgba(91,140,247,0.1)' : ''}">
        <span class="series-item-num">${si.series_order || ''}</span>
        <span class="series-item-title">${escapeHtml(si.title)}</span>
        ${isDone ? '<span class="series-item-check">&#10003;</span>' : ''}
      </div>`;
    });
    html += '</div>';
  }

  html += `<div class="detail-actions">
    ${item.status !== 'completed' ? `<button class="btn success" onclick="markCompleted('${item.id}')">Mark Completed</button>` : ''}
    ${item.status !== 'in_progress' ? `<button class="btn primary" onclick="setStatus('${item.id}','in_progress')">Start</button>` : ''}
    ${item.status === 'in_progress' || item.status === 'paused' ? `<button class="btn" style="color:var(--blue)" onclick="setStatus('${item.id}','want')">Want to Watch</button>` : ''}
    ${item.status === 'in_progress' ? `<button class="btn" style="color:var(--yellow)" onclick="setStatus('${item.id}','paused')">Pause</button>` : ''}
    ${item.status === 'in_progress' && item.media_type === 'series' ? `<button class="btn" style="color:var(--orange)" onclick="setStatus('${item.id}','waiting')">Caught Up</button>` : ''}
    ${item.status === 'waiting' ? `<button class="btn primary" onclick="setStatus('${item.id}','in_progress')">New Season!</button>` : ''}
    ${item.metadata?.trailerKey ? `<a class="btn trailer-btn" href="https://www.youtube.com/watch?v=${escapeHtml(item.metadata.trailerKey)}" target="_blank" rel="noopener">&#9654; Trailer</a>` : ''}
    <button class="btn" onclick="showEditForm('${item.id}')">Edit</button>
  </div>`;

  html += `<div style="margin-top:16px"><div class="section-title">Rating</div>
    <div class="rating-picker">
      ${[1,2,3,4,5].map(i => `<span class="star ${i <= (item.rating || 0) ? 'filled' : ''}" onclick="setRating('${item.id}', ${i})">&#9733;</span>`).join('')}
    </div>
  </div>`;

  document.getElementById('detail-body').innerHTML = html;
  document.getElementById('detail-modal').classList.remove('hidden');

  document.querySelectorAll('#detail-body .series-item[data-id]').forEach(el => {
    el.addEventListener('click', () => {
      showDetail(el.dataset.id);
    });
  });
}

// ── Status/Rating Updates ──

async function setStatus(id, status) {
  try {
    await apiPost('/api/entertainment/update', { id, status });
    closeModals();
    await loadData();
    showToast(`Updated to ${status.replace('_', ' ')}`);
  } catch (err) {
    console.error('Update failed:', err);
    alert('Failed to update: ' + err.message);
  }
}

async function markCompleted(id) {
  const item = allData.find(d => d.id === id);
  const newCount = (item?.times_completed || 0) + 1;
  try {
    await apiPost('/api/entertainment/update', { id, status: 'completed', times_completed: newCount });
    closeModals();
    await loadData();
    showToast('Marked as completed');
  } catch (err) {
    console.error('markCompleted failed:', err);
    alert('Failed: ' + err.message);
  }
}

async function setRating(id, rating) {
  try {
    await apiPost('/api/entertainment/update', { id, rating });
    const item = allData.find(d => d.id === id);
    if (item) item.rating = rating;
    showDetail(id);
  } catch (err) {
    console.error('setRating failed:', err);
  }
}

// ── Edit Form ──

function showEditForm(id) {
  const item = id ? allData.find(d => d.id === id) : null;
  const isNew = !item;

  const html = `
    <h2 style="font-size:1.1rem;font-weight:700;margin-bottom:16px">${isNew ? 'Add New Item' : 'Edit'}</h2>
    <form id="edit-form">
      <div class="form-group">
        <label class="form-label">Title</label>
        <input class="form-input" name="title" value="${escapeHtml(item?.title || '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" name="media_type">
          <option value="audiobook" ${item?.media_type === 'audiobook' ? 'selected' : ''}>Audiobook</option>
          <option value="series" ${item?.media_type === 'series' ? 'selected' : ''}>Series</option>
          <option value="limited_series" ${item?.media_type === 'limited_series' ? 'selected' : ''}>Limited Series</option>
          <option value="movie" ${item?.media_type === 'movie' ? 'selected' : ''}>Movie</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Creator / Author</label>
        <input class="form-input" name="creator" value="${escapeHtml(item?.creator || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Platform</label>
        <select class="form-select" name="platform" onchange="toggleOtherPlatform(this)">
          <option value="">Select...</option>
          ${['Audible','Netflix','Amazon Prime','Hulu','Paramount Plus','Starz','Apple TV+','Disney+','HBO Max','Peacock','Tubi'].map(p => {
            const selected = item?.platform === p ? 'selected' : '';
            return `<option value="${p}" ${selected}>${p}</option>`;
          }).join('')}
          <option value="__other__" ${item?.platform && !['Audible','Netflix','Amazon Prime','Hulu','Paramount Plus','Starz','Apple TV+','Disney+','HBO Max','Peacock','Tubi'].includes(item.platform) ? 'selected' : ''}>Other...</option>
        </select>
        <input class="form-input" name="platform_other" placeholder="Enter platform name"
          value="${item?.platform && !['Audible','Netflix','Amazon Prime','Hulu','Paramount Plus','Starz','Apple TV+','Disney+','HBO Max','Peacock','Tubi'].includes(item.platform) ? escapeHtml(item.platform) : ''}"
          style="margin-top:6px;display:${item?.platform && !['Audible','Netflix','Amazon Prime','Hulu','Paramount Plus','Starz','Apple TV+','Disney+','HBO Max','Peacock','Tubi'].includes(item.platform) ? 'block' : 'none'}">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" name="status">
          ${[
            ['want',       'Want to Watch'],
            ['in_progress','In Progress'],
            ['waiting',    'Waiting for New Season'],
            ['paused',     'Paused'],
            ['completed',  'Completed'],
            ['dropped',    'Dropped'],
          ].map(([val, label]) =>
            `<option value="${val}" ${item?.status === val ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Series Name</label>
        <input class="form-input" name="series_name" value="${escapeHtml(item?.series_name || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Series Order</label>
        <input class="form-input" name="series_order" type="number" value="${item?.series_order || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Genre</label>
        <input class="form-input" name="genre" value="${escapeHtml(item?.genre || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" name="notes">${escapeHtml(item?.notes || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Current Position</label>
        <input class="form-input" name="current_position" value="${escapeHtml(item?.current_position || '')}">
      </div>
      <div class="detail-actions">
        <button type="submit" class="btn primary">${isNew ? 'Add' : 'Save'}</button>
        <button type="button" class="btn" onclick="closeModals()">Cancel</button>
      </div>
    </form>
  `;

  document.getElementById('edit-body').innerHTML = html;
  document.getElementById('edit-modal').classList.remove('hidden');
  document.getElementById('detail-modal').classList.add('hidden');

  document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = {
      title: form.title.value,
      media_type: form.media_type.value,
      creator: form.creator.value || null,
      platform: (form.platform.value === '__other__' ? form.platform_other.value : form.platform.value) || null,
      status: form.status.value,
      series_name: form.series_name.value || null,
      series_order: form.series_order.value ? parseInt(form.series_order.value) : null,
      genre: form.genre.value || null,
      notes: form.notes.value || null,
      current_position: form.current_position.value || null,
    };

    try {
      if (isNew) {
        data.owned = data.media_type === 'audiobook';
        data.userTelegramId = CURRENT_USER_ID;
        await apiPost('/api/entertainment/insert', data);
      } else {
        // Strip null/undefined -- Convex optional fields reject null
        const updatePayload = { id };
        Object.entries(data).forEach(([k, v]) => { if (v != null) updatePayload[k] = v; });
        await apiPost('/api/entertainment/update', updatePayload);
      }
      closeModals();
      await loadData();
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
  });
}

// ── Search & Filter (Audiobooks) ──

function bindSearch() {
  const searchInput = document.getElementById('audiobook-search');
  const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');

  if (searchInput) {
    searchInput.addEventListener('input', () => filterAudiobooks());
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterAudiobooks();
    });
  });
}

function filterAudiobooks() {
  const query = (document.getElementById('audiobook-search')?.value || '').toLowerCase();
  const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';

  let items = getByType('audiobook');

  if (activeFilter === 'in_progress') items = items.filter(d => d.status === 'in_progress');
  else if (activeFilter === 'completed') items = items.filter(d => d.status === 'completed');
  else if (activeFilter === 'series') items = items.filter(d => d.series_name);
  else if (activeFilter === 'standalone') items = items.filter(d => !d.series_name);

  if (query) {
    items = items.filter(d => {
      const searchable = [d.title, d.creator, d.series_name, d.metadata?.narrator, d.genre].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }

  const { groups, standalone } = getSeriesGroups(items);
  const listEl = document.getElementById('audiobook-list');
  if (listEl) {
    const html = renderAudiobookList(groups, standalone, items);
    listEl.innerHTML = html || '<div class="no-results">No audiobooks match your search.</div>';
    bindCardClicks();
    bindSeriesGroupToggles();
    bindCollapsibles();
  }
}

// ── Global Search ──

function renderSearchResults(query) {
  const q = query.toLowerCase();
  const results = allData.filter(d => {
    const searchable = [d.title, d.creator, d.genre, d.series_name, d.platform, d.metadata?.narrator, d.notes]
      .filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(q);
  });

  if (!results.length) return '<div class="empty-state">No results for &ldquo;' + escapeHtml(query) + '&rdquo;</div>';

  const byType = { movie: [], series: [], limited_series: [], audiobook: [] };
  results.forEach(d => {
    const t = d.media_type || 'movie';
    if (byType[t]) byType[t].push(d); else byType.movie.push(d);
  });

  let html = `<div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:16px">${results.length} result${results.length !== 1 ? 's' : ''} for &ldquo;${escapeHtml(query)}&rdquo;</div>`;

  [['movie','Movies'], ['series','Series'], ['limited_series','Limited Series'], ['audiobook','Audiobooks']].forEach(([type, label]) => {
    if (!byType[type].length) return;
    html += sectionTitle(label, byType[type].length);
    byType[type].forEach(d => { html += card(d); });
  });

  return html;
}

// ── Surprise Me ──

function surpriseMe() {
  const pool = allData.filter(d => d.status === 'want' && d.media_type !== 'audiobook');
  if (!pool.length) { showToast('Nothing in your want list!'); return; }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  showDetail(pick.id);
}

// ── Stats Tab ──

function renderStatsTab() {
  const movies = allData.filter(d => d.media_type === 'movie');
  const series = allData.filter(d => d.media_type === 'series');
  const limited = allData.filter(d => d.media_type === 'limited_series');
  const books = allData.filter(d => d.media_type === 'audiobook');

  const completed = allData.filter(d => d.status === 'completed');
  const inProgress = allData.filter(d => d.status === 'in_progress');
  const wantList = allData.filter(d => d.status === 'want');

  const rated = allData.filter(d => d.rating);
  const avgRating = rated.length ? (rated.reduce((s, d) => s + d.rating, 0) / rated.length).toFixed(1) : null;

  // Top genres
  const genreCounts = {};
  allData.forEach(d => {
    if (!d.genre) return;
    d.genre.split(',').forEach(g => {
      const clean = g.trim();
      if (clean) genreCounts[clean] = (genreCounts[clean] || 0) + 1;
    });
  });
  const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Top platforms
  const platCounts = {};
  allData.forEach(d => {
    if (!d.platform) return;
    platCounts[d.platform] = (platCounts[d.platform] || 0) + 1;
  });
  const topPlats = Object.entries(platCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Best rated completed
  const bestRated = completed.filter(d => d.rating >= 4).sort((a, b) => (b.rating - a.rating) || a.title.localeCompare(b.title)).slice(0, 5);

  const statBox = (label, value, sub = '') =>
    `<div class="stat-box"><div class="stat-value">${value}</div><div class="stat-label">${label}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;

  const barRow = (label, count, max) =>
    `<div class="bar-row"><span class="bar-label">${escapeHtml(label)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round((count/max)*100)}%"></div></div><span class="bar-count">${count}</span></div>`;

  let html = '';

  // Overview boxes
  html += `<div class="stat-grid">
    ${statBox('Total', allData.length)}
    ${statBox('Completed', completed.length)}
    ${statBox('In Progress', inProgress.length)}
    ${statBox('Want List', wantList.length)}
  </div>`;

  // By type
  html += `<div class="stat-grid" style="margin-top:8px">
    ${statBox('Movies', movies.length, `${movies.filter(d=>d.status==='completed').length} done`)}
    ${statBox('Series', series.length, `${series.filter(d=>d.status==='completed').length} done`)}
    ${statBox('Limited', limited.length, `${limited.filter(d=>d.status==='completed').length} done`)}
    ${statBox('Audiobooks', books.length, `${books.filter(d=>d.status==='completed').length} done`)}
  </div>`;

  if (avgRating) {
    html += `<div class="stat-grid" style="margin-top:8px">
      ${statBox('Avg Rating', avgRating + ' ★', `from ${rated.length} rated`)}
    </div>`;
  }

  // Top genres
  if (topGenres.length) {
    const maxG = topGenres[0][1];
    html += `<div class="section-title" style="margin-top:24px">Top Genres</div><div class="bar-list">`;
    topGenres.forEach(([g, c]) => { html += barRow(g, c, maxG); });
    html += '</div>';
  }

  // Top platforms
  if (topPlats.length) {
    const maxP = topPlats[0][1];
    html += `<div class="section-title" style="margin-top:16px">By Platform</div><div class="bar-list">`;
    topPlats.forEach(([p, c]) => { html += barRow(p, c, maxP); });
    html += '</div>';
  }

  // Best rated
  if (bestRated.length) {
    html += `<div class="section-title" style="margin-top:16px">Highest Rated</div>`;
    bestRated.forEach(d => { html += card(d); });
  }

  return html;
}

// ── Shared UI Helpers ──

function sectionTitle(text, count, collapsible = false) {
  return `<div class="section-title ${collapsible ? 'collapsible' : ''}" ${collapsible ? 'data-collapse-toggle' : ''}>
    ${collapsible ? '<span class="chevron">&#9660;</span>' : ''}
    ${text}
    ${count !== undefined ? `<span class="count">${count}</span>` : ''}
  </div>`;
}

function bindCardClicks() {
  document.querySelectorAll('.card[data-id], .hero-card[data-id], .series-item[data-id], .queue-item[data-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showDetail(el.dataset.id);
    });
  });
}

function bindCollapsibles() {
  document.querySelectorAll('[data-collapse-toggle]').forEach(el => {
    el.addEventListener('click', () => {
      el.classList.toggle('collapsed');
      const content = el.nextElementSibling;
      if (content?.classList.contains('collapsible-content')) {
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        content.dataset.collapsed = isHidden ? 'false' : 'true';
      }
    });
  });
}

function bindSeriesGroupToggles() {
  document.querySelectorAll('[data-toggle-series]').forEach(el => {
    el.addEventListener('click', () => {
      const items = el.nextElementSibling;
      if (items) {
        items.style.display = items.style.display === 'none' ? 'block' : 'none';
      }
    });
  });
}

function closeModals() {
  document.getElementById('detail-modal').classList.add('hidden');
  document.getElementById('edit-modal').classList.add('hidden');
}

// ── Platform Other Toggle ──

function toggleOtherPlatform(select) {
  const otherInput = select.parentElement.querySelector('[name="platform_other"]');
  if (otherInput) {
    otherInput.style.display = select.value === '__other__' ? 'block' : 'none';
    if (select.value !== '__other__') otherInput.value = '';
  }
}

// ── Toast ──

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2000);
}

// ── Init ──

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    location.hash = btn.dataset.tab;
    searchQuery = '';
    const gs = document.getElementById('global-search');
    if (gs) gs.value = '';
    renderTab(btn.dataset.tab);
  });
});

document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', closeModals);
});

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModals();
  });
});

document.getElementById('fab-add').addEventListener('click', () => {
  showEditForm(null);
});


// Global search
const globalSearch = document.getElementById('global-search');
if (globalSearch) {
  globalSearch.addEventListener('input', () => {
    searchQuery = globalSearch.value.trim();
    renderTab(currentTab);
  });
}

const hash = location.hash.replace('#', '');
if (['tonight', 'series', 'movies', 'audiobooks', 'stats'].includes(hash)) {
  currentTab = hash;
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === hash);
  });
}

// ── Set page title for current user ──
document.querySelector('header h1').textContent = CURRENT_USER_NAME;
document.title = CURRENT_USER_NAME;

// ── Voice / Quick Add ──

function showVoiceAdd() {
  document.getElementById('voice-add-modal').classList.remove('hidden');
  document.getElementById('voice-title').value = '';
  document.getElementById('voice-title').focus();
}

function closeVoiceAdd() {
  document.getElementById('voice-add-modal').classList.add('hidden');
}


async function submitVoiceAdd() {
  const title = document.getElementById('voice-title').value.trim();
  const mediaType = document.getElementById('voice-type').value;
  const platform = document.getElementById('voice-platform').value;
  if (!title) {
    document.getElementById('voice-title').focus();
    return;
  }
  const btn = document.getElementById('voice-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Adding...';
  try {
    await apiPost('/api/entertainment/add', {
      title,
      media_type: mediaType,
      platform: platform || undefined,
      userTelegramId: CURRENT_USER_ID,
    });
    closeVoiceAdd();
    await loadData();
    showToast(`Added "${title}"`);
  } catch (err) {
    alert('Failed to add: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Add to List';
  }
}

document.getElementById('voice-add-modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('voice-add-modal')) closeVoiceAdd();
});

// ── AI Chat ──

const CHAT_KEY = 'entChat_' + CURRENT_USER_ID;

let chatHistory = [];

function saveChatHistory() {
  try { sessionStorage.setItem(CHAT_KEY, JSON.stringify(chatHistory)); } catch (_) {}
}

function loadChatHistory() {
  try {
    const saved = sessionStorage.getItem(CHAT_KEY);
    if (saved) chatHistory = JSON.parse(saved);
  } catch (_) { chatHistory = []; }
}

function restoreChatMessages() {
  const msgs = document.getElementById('chat-messages');
  chatHistory.forEach(m => {
    const el = document.createElement('div');
    el.className = m.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai';
    if (m.role === 'user') {
      el.textContent = m.content;
    } else {
      el.innerHTML = formatAIText(m.content);
    }
    msgs.appendChild(el);
  });
  msgs.scrollTop = msgs.scrollHeight;
}

function toggleChat() {
  const panel = document.getElementById('chat-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    document.getElementById('chat-messages').scrollTop = 999999;
    document.getElementById('chat-input').focus();
  }
}

function formatAIText(text) {
  // Escape HTML entities first
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // Bold: **text**
  let html = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Force inline bullets onto their own lines (handles • or - mid-paragraph)
  html = html.replace(/\s*[•]\s*/g, '\n• ');
  html = html.replace(/\s*-\s+(?=<strong>)/g, '\n• ');
  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');
  // Clean up leading <br> or stray bullets at start
  html = html.replace(/^(<br>|•\s*)+/, '');
  // Clean up double <br>
  html = html.replace(/(<br>){2,}/g, '<br>');
  return html;
}

function appendChatMsg(role, text) {
  const el = document.createElement('div');
  el.className = role === 'user' ? 'chat-msg-user' : 'chat-msg-ai';
  if (role === 'user') {
    el.textContent = text;
  } else {
    el.innerHTML = formatAIText(text);
  }
  const msgs = document.getElementById('chat-messages');
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

function clearChat() {
  chatHistory = [];
  saveChatHistory();
  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML = '<div class="chat-msg-ai chat-welcome">What can I help you with? You can say things like "add Jaws 1, 2, and 3" or "I finished Severance" or "remove The Crown".</div>';
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  input.style.height = 'auto';

  appendChatMsg('user', message);
  const thinking = appendChatMsg('ai', '...');
  const sendBtn = document.getElementById('chat-send');
  sendBtn.disabled = true;

  try {
    const res = await apiPost('/api/entertainment/chat', {
      message,
      history: chatHistory,
      userTelegramId: CURRENT_USER_ID,
    });
    const reply = res.reply || 'Done.';
    thinking.innerHTML = formatAIText(reply);
    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'assistant', content: reply });
    if (chatHistory.length > 40) chatHistory = chatHistory.slice(-40);
    saveChatHistory();
    if (res.refresh) await loadData();
  } catch (err) {
    thinking.innerHTML = 'Something went wrong. Try again.';
  } finally {
    sendBtn.disabled = false;
    document.getElementById('chat-input').focus();
  }
}


// Restore chat history on load
loadChatHistory();
restoreChatMessages();

function resizeChatInput() {
  const el = document.getElementById('chat-input');
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

const chatInput = document.getElementById('chat-input');

document.getElementById('chat-btn').addEventListener('click', toggleChat);
document.getElementById('chat-close').addEventListener('click', toggleChat);
document.getElementById('chat-new').addEventListener('click', clearChat);
document.getElementById('chat-send').addEventListener('click', sendChat);
chatInput.addEventListener('input', resizeChatInput);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
});

loadData();
