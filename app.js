const SUPABASE_URL = 'https://gnpzqjmeiusniabmxomt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImducHpxam1laXVzbmlhYm14b210Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3Nzc1NDAsImV4cCI6MjA2MzM1MzU0MH0.JnL0eLrvcJ3Fo2eEkMM9pHvX6VKfJmgxy9gJNEnV_84';
const USER_ID = '6285585111';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allData = [];
let currentTab = 'tonight';
let currentSubFilter = {}; // track per-tab sub-filter

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
  const { data, error } = await sb
    .from('entertainment')
    .select('*')
    .eq('user_telegram_id', USER_ID)
    .order('series_name', { ascending: true, nullsFirst: false })
    .order('series_order', { ascending: true });

  if (error) {
    console.error('Failed to load:', error);
    document.getElementById('content').innerHTML = '<div class="loading">Failed to load data</div>';
    return;
  }
  allData = data || [];
  renderTab(currentTab);
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
  // Sort each group by series_order
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

  switch (tab) {
    case 'tonight': content.innerHTML = renderTonight(); break;
    case 'series': content.innerHTML = renderSeriesTab(); break;
    case 'movies': content.innerHTML = renderMoviesTab(); break;
    case 'audiobooks': content.innerHTML = renderAudiobooksTab(); break;
  }

  // Bind events after render
  bindCardClicks();
  bindCollapsibles();
  bindSeriesGroupToggles();
  bindSubFilters();
  if (tab === 'audiobooks') bindSearch();
}

// ── Tonight View ──

function renderTonight() {
  const screenItems = allData.filter(d => d.media_type === 'series' || d.media_type === 'movie' || d.media_type === 'limited_series');
  const inProgress = screenItems.filter(d => d.status === 'in_progress');
  const want = screenItems.filter(d => d.status === 'want');
  const waiting = screenItems.filter(d => d.status === 'waiting');

  const active = currentSubFilter['tonight'] || 'watching';

  let html = renderSubFilters([
    { key: 'watching', label: 'Currently Watching', count: inProgress.length },
    { key: 'want', label: 'Want to Watch', count: want.length },
    { key: 'waiting', label: 'Waiting', count: waiting.length },
  ], 'tonight');

  html += '<div class="sub-filter-content">';

  if (active === 'watching') {
    if (inProgress.length) {
      inProgress.forEach(d => { html += tonightCard(d, 'in_progress'); });
    } else {
      html += '<div class="empty-state">Nothing active. Pick something from Want to Watch.</div>';
    }
  } else if (active === 'want') {
    if (want.length) {
      const { groups, standalone } = getSeriesGroups(want);
      Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).forEach(([name, items]) => {
        const allInSeries = allData.filter(d => d.series_name === name).sort((a, b) => (a.series_order || 0) - (b.series_order || 0));
        html += renderSeriesGroup(name, allInSeries);
      });
      standalone.forEach(d => { html += tonightCard(d, 'want'); });
    } else {
      html += '<div class="empty-state">Queue is empty.</div>';
    }
  } else if (active === 'waiting') {
    if (waiting.length) {
      waiting.forEach(d => { html += tonightCard(d, 'waiting'); });
    } else {
      html += '<div class="empty-state">No shows waiting for new seasons.</div>';
    }
  }

  html += '</div>';
  return html;
}

function tonightCard(d, context) {
  const series = d.series_name ? `${escapeHtml(d.series_name)}${d.series_order ? ' #' + d.series_order : ''}` : '';
  const position = d.current_position ? escapeHtml(d.current_position) : '';

  let actionBtn = '';
  if (context === 'in_progress') {
    actionBtn = `<span class="btn-inline watching-status">Watching</span>`;
  } else if (context === 'want') {
    actionBtn = `<button class="btn-inline start" onclick="event.stopPropagation();setStatus(${d.id},'in_progress')">Start Watching</button>`;
  } else if (context === 'waiting') {
    actionBtn = `<button class="btn-inline new-season" onclick="event.stopPropagation();setStatus(${d.id},'in_progress')">New Season!</button>`;
  }

  const isHero = context === 'in_progress';

  return `<div class="${isHero ? 'hero-card' : 'card'}" data-id="${d.id}">
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
  </div>`;
}

function heroCard(d) {
  const narrator = d.metadata?.narrator ? `Narrated by ${escapeHtml(d.metadata.narrator)}` : '';
  const series = d.series_name ? `${escapeHtml(d.series_name)}${d.series_order ? ' #' + d.series_order : ''}` : '';
  const position = d.current_position ? `<div class="card-subtitle">${escapeHtml(d.current_position)}</div>` : '';
  const timesInfo = d.times_completed > 1 ? ` (Listen #${d.times_completed + 1})` : '';

  return `<div class="hero-card" data-id="${d.id}">
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
  </div>`;
}

function card(d, opts = {}) {
  const narrator = d.media_type === 'audiobook' && d.metadata?.narrator ? ` &middot; ${escapeHtml(d.metadata.narrator)}` : '';
  const series = d.series_name ? `${escapeHtml(d.series_name)}${d.series_order ? ' #' + d.series_order : ''}` : '';
  const style = opts.muted ? 'opacity:0.7' : '';

  return `<div class="card" data-id="${d.id}" style="${style}">
    <div class="card-header">
      <div>
        <div class="card-title">${escapeHtml(d.title)}</div>
        <div class="card-subtitle">${escapeHtml(d.creator)}${narrator}</div>
        ${series ? `<div class="card-subtitle" style="font-size:0.75rem">${series}</div>` : ''}
        ${d.notes ? `<div class="card-subtitle" style="font-style:italic;font-size:0.75rem">${escapeHtml(d.notes)}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <span class="status-dot ${d.status}"></span>
        ${d.rating ? renderStars(d.rating) : ''}
      </div>
    </div>
    <div class="card-meta">
      <span class="platform-badge ${platformClass(d.platform)}">${escapeHtml(d.platform || 'Unknown')}</span>
      ${d.times_completed > 1 ? `<span style="font-size:0.7rem;color:var(--text-muted)">${d.times_completed}x</span>` : ''}
      ${d.metadata?.runtime_minutes ? `<span style="font-size:0.7rem;color:var(--text-dim)">${formatRuntime(d.metadata.runtime_minutes)}</span>` : ''}
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
      // Show franchise groups for want items
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
      // Show franchise groups for watched items
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

  // Search bar
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

  // Render all audiobook content into a filterable container
  html += '<div id="audiobook-list">';
  html += renderAudiobookList(groups, standalone, items);
  html += '</div>';

  return html;
}

function renderAudiobookList(groups, standalone, allAudiobooks) {
  let html = '';

  // Summary
  const completed = allAudiobooks.filter(d => d.status === 'completed').length;
  const inProg = allAudiobooks.filter(d => d.status === 'in_progress').length;
  html += `<div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:16px">
    ${allAudiobooks.length} audiobooks &middot; ${Object.keys(groups).length} series &middot; ${completed} completed &middot; ${inProg} in progress
  </div>`;

  // Series groups
  const sortedSeries = Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  if (sortedSeries.length) {
    html += sectionTitle('Series', sortedSeries.length);
    sortedSeries.forEach(([name, items]) => {
      html += renderSeriesGroup(name, items);
    });
  }

  // Standalone
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

  // Load history
  const { data: history } = await sb
    .from('entertainment_history')
    .select('*')
    .eq('entertainment_id', id)
    .eq('user_telegram_id', USER_ID)
    .order('event_date', { ascending: false });

  const narrator = item.metadata?.narrator || '';
  const runtime = item.metadata?.runtime_minutes ? formatRuntime(item.metadata.runtime_minutes) : '';
  const series = item.series_name || '';
  const seriesItems = series ? allData.filter(d => d.series_name === series).sort((a, b) => (a.series_order || 0) - (b.series_order || 0)) : [];
  const seriesPos = series && item.series_order ? `Book ${item.series_order} of ${seriesItems.length}` : '';

  let html = `
    <div class="detail-title">${escapeHtml(item.title)}</div>
    <div class="detail-creator">${escapeHtml(item.creator)}</div>

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

  // Series context
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

  // Actions
  html += `<div class="detail-actions">
    ${item.status !== 'completed' ? `<button class="btn success" onclick="markCompleted(${item.id})">Mark Completed</button>` : ''}
    ${item.status !== 'in_progress' ? `<button class="btn primary" onclick="setStatus(${item.id},'in_progress')">Start</button>` : ''}
    ${item.status === 'in_progress' ? `<button class="btn" style="color:var(--yellow)" onclick="setStatus(${item.id},'paused')">Pause</button>` : ''}
    ${item.status === 'in_progress' && item.media_type === 'series' ? `<button class="btn" style="color:var(--orange)" onclick="setStatus(${item.id},'waiting')">Caught Up</button>` : ''}
    ${item.status === 'waiting' ? `<button class="btn primary" onclick="setStatus(${item.id},'in_progress')">New Season!</button>` : ''}
    <button class="btn" onclick="showEditForm(${item.id})">Edit</button>
  </div>`;

  // Rating picker
  html += `<div style="margin-top:16px"><div class="section-title">Rating</div>
    <div class="rating-picker">
      ${[1,2,3,4,5].map(i => `<span class="star ${i <= (item.rating || 0) ? 'filled' : ''}" onclick="setRating(${item.id}, ${i})">&#9733;</span>`).join('')}
    </div>
  </div>`;

  // History
  if (history?.length) {
    html += `<div style="margin-top:16px"><div class="section-title">History</div>`;
    history.forEach(h => {
      const date = h.event_date ? new Date(h.event_date).toLocaleDateString() : '';
      html += `<div class="history-entry">
        <div class="history-dot"></div>
        <div>
          <div>${escapeHtml(h.event_type)}${h.notes ? ': ' + escapeHtml(h.notes) : ''}</div>
          <div class="history-date">${date}</div>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  document.getElementById('detail-body').innerHTML = html;
  document.getElementById('detail-modal').classList.remove('hidden');

  // Bind series item clicks inside modal
  document.querySelectorAll('#detail-body .series-item[data-id]').forEach(el => {
    el.addEventListener('click', () => {
      showDetail(parseInt(el.dataset.id));
    });
  });
}

// ── Status/Rating Updates ──

async function setStatus(id, status) {
  const updates = { status, updated_at: new Date().toISOString() };

  const { error } = await sb.from('entertainment').update(updates).eq('id', id);
  if (error) {
    console.error('Update failed:', error);
    alert('Failed to update: ' + error.message);
    return;
  }

  // Create history entry (don't block on failure)
  const { error: histErr } = await sb.from('entertainment_history').insert({
    entertainment_id: id,
    event_type: status === 'completed' ? 'completed' : (status === 'in_progress' ? 'started' : status),
    event_date: new Date().toISOString(),
    user_telegram_id: USER_ID
  });
  if (histErr) console.error('History insert failed:', histErr);

  // Close modal and refresh
  closeModals();
  await loadData();
  showToast(`Updated to ${status.replace('_', ' ')}`);
}

async function markCompleted(id) {
  const item = allData.find(d => d.id === id);
  const newCount = (item?.times_completed || 0) + 1;

  await sb.from('entertainment').update({
    status: 'completed',
    times_completed: newCount,
    updated_at: new Date().toISOString()
  }).eq('id', id);

  await sb.from('entertainment_history').insert({
    entertainment_id: id,
    event_type: 'completed',
    listen_number: newCount,
    event_date: new Date().toISOString(),
    user_telegram_id: USER_ID
  });

  closeModals();
  await loadData();
  showToast('Marked as completed');
}

async function setRating(id, rating) {
  await sb.from('entertainment').update({
    rating,
    updated_at: new Date().toISOString()
  }).eq('id', id);

  const item = allData.find(d => d.id === id);
  if (item) item.rating = rating;
  showDetail(id);
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
          ${['want','in_progress','waiting','paused','completed','dropped'].map(s =>
            `<option value="${s}" ${item?.status === s ? 'selected' : ''}>${s.replace('_',' ')}</option>`
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
      user_telegram_id: USER_ID,
      updated_at: new Date().toISOString()
    };

    if (isNew) {
      data.owned = data.media_type === 'audiobook';
      await sb.from('entertainment').insert(data);
    } else {
      await sb.from('entertainment').update(data).eq('id', id);
    }

    closeModals();
    await loadData();
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

  // Apply status/type filter
  if (activeFilter === 'in_progress') items = items.filter(d => d.status === 'in_progress');
  else if (activeFilter === 'completed') items = items.filter(d => d.status === 'completed');
  else if (activeFilter === 'series') items = items.filter(d => d.series_name);
  else if (activeFilter === 'standalone') items = items.filter(d => !d.series_name);

  // Apply search
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
      showDetail(parseInt(el.dataset.id));
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

// Restore tab from URL hash
const hash = location.hash.replace('#', '');
if (['tonight', 'series', 'movies', 'audiobooks'].includes(hash)) {
  currentTab = hash;
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === hash);
  });
}

// Load!
loadData();
