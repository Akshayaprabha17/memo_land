/* ============================================
   MEMORY LOCK — Client Application Logic
   v4: Heatmap, Markdown, Theme Toggle
   ============================================ */

(function () {
  'use strict';

  // --- State ---
  let allMemories = [];       // accumulated across pages
  let page = 1;
  let hasMore = false;
  let totalCount = 0;
  let isLoadingMore = false;
  let activeCategory = 'all';
  let searchQuery = '';
  let sortBy = 'newest';
  let filterTag = null;       // active tag filter (null = none)
  let filterDate = null;      // active date filter (YYYY-MM-DD)
  let formTags = [];          // tags being edited in the form

  let currentViewMemory = null;
  let actionTargetMemoryId = null;
  let isPermanentUnlock = false;

  const PAGE_LIMIT = 12;

  // --- DOM Elements ---
  const grid = document.getElementById('memory-grid');
  const skeletonGrid = document.getElementById('skeleton-grid');
  const emptyState = document.getElementById('empty-state');
  const emptySearchState = document.getElementById('empty-search-state');
  const emptySearchMsg = document.getElementById('empty-search-msg');
  const emptySearchClear = document.getElementById('empty-search-clear');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const searchKbd = document.getElementById('search-kbd');
  const countNumber = document.getElementById('count-number');
  const fabAdd = document.getElementById('fab-add');
  const catButtons = document.querySelectorAll('.cat-btn');
  const sortSelect = document.getElementById('sort-select');
  const resultsInfo = document.getElementById('results-info');
  const tagFilterBar = document.getElementById('tag-filter-bar');
  const tagFilterChips = document.getElementById('tag-filter-chips');
  const tagClearBtn = document.getElementById('tag-clear-btn');
  const loadMoreSpinner = document.getElementById('load-more-spinner');
  const scrollSentinel = document.getElementById('scroll-sentinel');

  // Heatmap
  const heatmapContainer = document.getElementById('heatmap-container');
  const heatmapGrid = document.getElementById('heatmap-grid');
  const heatmapClearBtn = document.getElementById('heatmap-clear-btn');

  // Theme
  const themeToggleBtn = document.getElementById('theme-toggle');
  const iconMoon = document.querySelector('.icon-moon');
  const iconSun = document.querySelector('.icon-sun');

  // Form Modal
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const memoryForm = document.getElementById('memory-form');
  const memoryIdInput = document.getElementById('memory-id');
  const titleInput = document.getElementById('memory-title-input');
  const contentInput = document.getElementById('memory-content-input');
  const contentPreview = document.getElementById('memory-content-preview');
  const tabWrite = document.getElementById('tab-write');
  const tabPreview = document.getElementById('tab-preview');
  const categoryInput = document.getElementById('memory-category-input');
  const charCount = document.getElementById('char-count');
  const btnCancel = document.getElementById('btn-cancel');
  const modalClose = document.getElementById('modal-close');
  const formTagPills = document.getElementById('form-tag-pills');
  const tagTextInput = document.getElementById('tag-text-input');

  // View Modal
  const viewOverlay = document.getElementById('view-modal-overlay');
  const viewModalTitle = document.getElementById('view-modal-title');
  const viewCategory = document.getElementById('view-category');
  const viewTagsEl = document.getElementById('view-tags');
  const viewContent = document.getElementById('view-content');
  const viewMeta = document.getElementById('view-meta');
  const viewModalClose = document.getElementById('view-modal-close');
  const viewEditBtn = document.getElementById('view-edit-btn');
  const viewDeleteBtn = document.getElementById('view-delete-btn');

  // Toast + PIN
  const toastContainer = document.getElementById('toast-container');
  const pinSetupOverlay = document.getElementById('pin-setup-overlay');
  const pinSetupForm = document.getElementById('pin-setup-form');
  const newPinInput = document.getElementById('new-pin-input');
  const pinSetupClose = document.getElementById('pin-setup-close');
  const pinEntryOverlay = document.getElementById('pin-entry-overlay');
  const pinEntryForm = document.getElementById('pin-entry-form');
  const enterPinInput = document.getElementById('enter-pin-input');
  const pinEntryClose = document.getElementById('pin-entry-close');

  // --- Particles ---
  function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    const count = 50;
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5, alpha: Math.random() * 0.3 + 0.05,
        color: ['124,58,237','167,139,250','245,158,11','14,165,233'][Math.floor(Math.random()*4)]
      });
    }
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`; ctx.fill();
      });
      requestAnimationFrame(animate);
    }
    animate();
  }

  // --- Theme Toggle ---
  function initTheme() {
    const isLight = localStorage.getItem('theme') === 'light';
    if (isLight) enableLightMode();
    
    themeToggleBtn.addEventListener('click', () => {
      if (document.body.classList.contains('light-theme')) {
        disableLightMode();
      } else {
        enableLightMode();
      }
    });
  }
  function enableLightMode() {
    document.body.classList.add('light-theme');
    iconMoon.style.display = 'none';
    iconSun.style.display = 'block';
    localStorage.setItem('theme', 'light');
  }
  function disableLightMode() {
    document.body.classList.remove('light-theme');
    iconMoon.style.display = 'block';
    iconSun.style.display = 'none';
    localStorage.setItem('theme', 'dark');
  }

  // --- Markdown Helper ---
  function renderMarkdown(text) {
    if (!text) return '';
    // marked and DOMPurify are loaded via CDN
    if (window.marked && window.DOMPurify) {
      const rawHtml = marked.parse(text, { breaks: true });
      return DOMPurify.sanitize(rawHtml);
    }
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  // --- Skeleton helpers ---
  function showSkeleton() {
    if (skeletonGrid) skeletonGrid.style.display = 'grid';
    grid.style.display = 'none';
    emptyState.style.display = 'none';
    if (emptySearchState) emptySearchState.style.display = 'none';
    if (loadMoreSpinner) loadMoreSpinner.style.display = 'none';
  }

  function hideSkeleton() {
    if (skeletonGrid) skeletonGrid.style.display = 'none';
    grid.style.display = '';
  }

  // --- Build fetch URL ---
  function buildUrl(pg) {
    const base = (searchQuery || filterDate) ? '/api/memories/search' : '/api/memories';
    const params = new URLSearchParams({ page: pg, limit: PAGE_LIMIT, sort: sortBy });
    if (searchQuery) params.set('q', searchQuery);
    else if (activeCategory !== 'all') params.set('category', activeCategory);
    if (filterTag) params.set('tag', filterTag);
    if (filterDate) params.set('date', filterDate);
    return `${base}?${params}`;
  }

  // --- Fetch page 1 (reset) ---
  async function fetchMemories() {
    allMemories = [];
    page = 1;
    hasMore = false;
    totalCount = 0;
    showSkeleton();

    try {
      const res = await fetch(buildUrl(1));
      const result = await res.json();
      allMemories = result.data || [];
      hasMore = result.hasMore || false;
      totalCount = result.total || 0;
      page = 1;
      hideSkeleton();
      render();
      updateResultsInfo();
      fetchTags();
      fetchHeatmap();
    } catch (err) {
      hideSkeleton();
      showToast('Failed to load memories', 'error');
    }
  }

  // --- Load next page (append) ---
  async function loadMore() {
    if (isLoadingMore || !hasMore) return;
    isLoadingMore = true;
    if (loadMoreSpinner) loadMoreSpinner.style.display = 'flex';

    try {
      const nextPage = page + 1;
      const res = await fetch(buildUrl(nextPage));
      const result = await res.json();
      allMemories = [...allMemories, ...(result.data || [])];
      hasMore = result.hasMore || false;
      page = nextPage;
      isLoadingMore = false;
      if (loadMoreSpinner) loadMoreSpinner.style.display = 'none';
      render(true);  // append-only render
      updateResultsInfo();
    } catch (err) {
      isLoadingMore = false;
      if (loadMoreSpinner) loadMoreSpinner.style.display = 'none';
    }
  }

  // --- Results info ---
  function updateResultsInfo() {
    if (!resultsInfo) return;
    if (totalCount === 0) { resultsInfo.textContent = ''; return; }
    const shown = allMemories.length;
    let text = shown < totalCount
      ? `Showing ${shown} of ${totalCount} memories`
      : `${totalCount} ${totalCount === 1 ? 'memory' : 'memories'}`;
    if (filterDate) {
      const d = new Date(filterDate);
      text += ` on ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    resultsInfo.textContent = text;
  }

  // --- Tags API ---
  async function fetchTags() {
    try {
      const res = await fetch('/api/tags');
      const tags = await res.json();
      renderTagFilterBar(tags);
    } catch (e) { /* silent */ }
  }

  function renderTagFilterBar(tags) {
    if (!tagFilterBar || !tagFilterChips) return;
    if (!tags.length) { tagFilterBar.style.display = 'none'; return; }
    tagFilterBar.style.display = 'flex';
    tagClearBtn.style.display = filterTag ? '' : 'none';

    tagFilterChips.innerHTML = tags.map(t => `
      <button class="tag-chip${filterTag === t.name ? ' active' : ''}" data-tag="${escapeHtml(t.name)}">
        #${escapeHtml(t.name)} <span class="tag-count">${t.count}</span>
      </button>
    `).join('');

    tagFilterChips.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filterTag = filterTag === chip.dataset.tag ? null : chip.dataset.tag;
        fetchMemories();
      });
    });
  }

  // --- Heatmap API ---
  async function fetchHeatmap() {
    try {
      const res = await fetch('/api/heatmap');
      const counts = await res.json();
      renderHeatmap(counts);
    } catch (e) { /* silent */ }
  }

  function renderHeatmap(counts) {
    if (!heatmapGrid) return;
    
    heatmapGrid.innerHTML = '';
    const today = new Date();
    // 52 weeks * 7 days = 364 days ago
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 364);
    
    // Ensure we start on a Sunday to align the grid properly
    while(startDate.getDay() !== 0) {
      startDate.setDate(startDate.getDate() - 1);
    }

    const fragment = document.createDocumentFragment();
    let iterDate = new Date(startDate);
    
    while (iterDate <= today) {
      const dateStr = iterDate.toISOString().split('T')[0];
      const count = counts[dateStr] || 0;
      
      let lvl = 0;
      if (count > 0) lvl = 1;
      if (count >= 2) lvl = 2;
      if (count >= 4) lvl = 3;
      if (count >= 7) lvl = 4;

      const cell = document.createElement('div');
      cell.className = `heatmap-cell lvl-${lvl}`;
      if (filterDate === dateStr) cell.classList.add('active-filter');
      
      const niceDate = iterDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      cell.title = count === 0 ? `No memories on ${niceDate}` : `${count} memor${count===1?'y':'ies'} on ${niceDate}`;
      cell.dataset.date = dateStr;
      
      cell.addEventListener('click', () => {
        if (filterDate === dateStr) {
          filterDate = null; // toggle off
        } else {
          filterDate = dateStr;
          // Clear text search when filtering by date to avoid confusion
          searchQuery = '';
          searchInput.value = '';
          searchClear.classList.remove('visible');
        }
        heatmapClearBtn.style.display = filterDate ? 'inline-block' : 'none';
        fetchMemories();
      });
      
      fragment.appendChild(cell);
      iterDate.setDate(iterDate.getDate() + 1);
    }
    
    heatmapGrid.appendChild(fragment);
    
    // Scroll to the far right (most recent)
    const scrollContainer = document.querySelector('.heatmap-scroll');
    if (scrollContainer) scrollContainer.scrollLeft = scrollContainer.scrollWidth;
  }

  if (heatmapClearBtn) {
    heatmapClearBtn.addEventListener('click', () => {
      filterDate = null;
      heatmapClearBtn.style.display = 'none';
      fetchMemories();
    });
  }


  // --- CRUD ---
  async function createMemory(data) {
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Create failed'); }
      showToast('Memory saved ✨', 'success');
      fetchMemories();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function updateMemory(id, data) {
    try {
      const res = await fetch(`/api/memories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Update failed'); }
      return await res.json();
    } catch (err) { showToast(err.message, 'error'); return null; }
  }

  // pending delete timer — keyed by memory id
  const pendingDeletes = {};

  async function deleteMemory(id) {
    // Optimistically remove from local state and re-render
    const memoryToDelete = allMemories.find(m => m.id === id);
    if (!memoryToDelete) return;
    allMemories = allMemories.filter(m => m.id !== id);
    totalCount = Math.max(0, totalCount - 1);
    render();
    updateResultsInfo();

    // Show undo toast — actual DELETE fires after 5s
    showUndoToast('Memory deleted', async () => {
      // UNDO: restore and re-fetch
      clearTimeout(pendingDeletes[id]);
      delete pendingDeletes[id];
      allMemories = [memoryToDelete, ...allMemories];
      totalCount += 1;
      render();
      updateResultsInfo();
    }, async () => {
      // COMMIT: actually delete
      try {
        const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          // If server delete fails, silently restore
          const e = await res.json();
          allMemories = [memoryToDelete, ...allMemories];
          totalCount += 1;
          render();
          showToast(e.error || 'Delete failed', 'error');
        }
      } catch (err) {
        allMemories = [memoryToDelete, ...allMemories];
        totalCount += 1;
        render();
        showToast('Delete failed', 'error');
      }
    });
  }

  function showUndoToast(message, onUndo, onCommit, duration = 5000) {
    const toast = document.createElement('div');
    toast.className = 'toast info toast-undo';
    toast.innerHTML = `
      <span class="toast-icon">🗑️</span>
      <span class="toast-undo-msg">${escapeHtml(message)}</span>
      <button class="toast-undo-btn">Undo</button>
      <div class="toast-progress"><div class="toast-progress-bar"></div></div>
    `;
    toastContainer.appendChild(toast);

    // Animate the progress bar shrinking
    const bar = toast.querySelector('.toast-progress-bar');
    bar.style.transition = `width ${duration}ms linear`;
    // Trigger reflow then animate
    void bar.offsetWidth;
    bar.style.width = '0%';

    let undone = false;
    const undoBtn = toast.querySelector('.toast-undo-btn');

    function dismiss() {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }

    undoBtn.addEventListener('click', () => {
      if (undone) return;
      undone = true;
      clearTimeout(commitTimer);
      onUndo();
      dismiss();
      showToast('Restored ↩️', 'success');
    });

    const commitTimer = setTimeout(() => {
      if (undone) return;
      dismiss();
      onCommit();
    }, duration);
  }

  async function togglePin(id) {
    try {
      const res = await fetch(`/api/memories/${id}/pin`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Pin failed');
      const updated = await res.json();
      showToast(updated.pinned ? 'Memory pinned 📌' : 'Unpinned', 'info');
      fetchMemories();
    } catch (err) { showToast('Could not pin memory', 'error'); }
  }

  async function saveReorder(orderedMemories) {
    const order = orderedMemories.map((m, i) => ({ id: m.id, sortOrder: orderedMemories.length - i }));
    try {
      await fetch('/api/memories/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      });
    } catch (e) { /* silent */ }
  }

  function handleLockClick(id, currentLocked) {
    actionTargetMemoryId = id;
    if (!currentLocked) {
      pinSetupOverlay.classList.add('active');
      newPinInput.focus();
    } else {
      isPermanentUnlock = true;
      pinEntryOverlay.classList.add('active');
      enterPinInput.focus();
    }
  }

  // --- Rendering ---
  let dragSrcId = null;

  function render(appendOnly = false) {
    countNumber.textContent = totalCount;

    const noMemories = allMemories.length === 0 && !searchQuery && !filterTag && !filterDate;
    const noResults = allMemories.length === 0 && (!!searchQuery || !!filterTag || !!filterDate);

    emptyState.style.display = noMemories ? 'flex' : 'none';
    if (heatmapContainer) {
      heatmapContainer.style.display = (noMemories && !filterDate) ? 'none' : 'flex';
    }

    if (emptySearchState) {
      emptySearchState.style.display = noResults ? 'flex' : 'none';
      if (noResults && emptySearchMsg) {
        if (filterDate) emptySearchMsg.textContent = `No memories on this date.`;
        else if (searchQuery) emptySearchMsg.textContent = `No memories match "${searchQuery}"`;
        else emptySearchMsg.textContent = `No memories tagged #${filterTag}`;
      }
    }

    if (noMemories || noResults) { grid.innerHTML = ''; return; }

    if (appendOnly) {
      const existingCount = grid.querySelectorAll('.memory-card').length;
      const newMemories = allMemories.slice(existingCount);
      const frag = document.createDocumentFragment();
      newMemories.forEach((m, relIdx) => {
        const div = document.createElement('div');
        div.innerHTML = buildCardHTML(m, existingCount + relIdx).trim();
        frag.appendChild(div.firstElementChild);
      });
      grid.appendChild(frag);
    } else {
      grid.innerHTML = allMemories.map((m, i) => buildCardHTML(m, i)).join('');
    }

    attachCardListeners();
    attachDragHandlers();
  }

  function buildCardHTML(m, i) {
    const categoryEmojis = { personal:'💜', work:'💼', ideas:'💡', secrets:'🤫', important:'⭐' };
    const emoji = categoryEmojis[m.category] || '📝';
    const date = formatDate(m.createdAt);
    const lockIconSVG = m.locked
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 5-5 5 5 0 0 1 5 5"></path><line x1="17" y1="7" x2="17" y2="4"></line></svg>`;
    
    // Markdown rendering for card content
    const contentDisplay = m.locked 
      ? '••••• This memory is locked •••••' 
      : `<div class="markdown-body">${renderMarkdown(m.content)}</div>`;

    const pinBtnClass = `card-pin-btn${m.pinned ? ' pinned' : ''}`;
    const pinTitle = m.pinned ? 'Unpin memory' : 'Pin to top';

    const tags = m.tags || [];
    const cardTagsHTML = tags.length
      ? `<div class="card-tags">${tags.slice(0,3).map(t => `<span class="tag-chip-sm" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`).join('')}${tags.length > 3 ? `<span class="tag-more">+${tags.length - 3}</span>` : ''}</div>`
      : '';

    return `
      <article class="memory-card${m.pinned ? ' pinned-card' : ''}"
               data-category="${m.category}"
               data-id="${m.id}"
               style="animation-delay: ${Math.min(i,8) * 0.05}s"
               draggable="true">
        <div class="card-drag-handle" title="Drag to reorder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
        </div>
        <div class="card-top">
          <h3 class="card-title">${m.pinned ? '<span class="pin-indicator">📌</span>' : ''}${escapeHtml(m.title)}</h3>
          <div class="card-actions">
            <button class="${pinBtnClass}" data-pin-id="${m.id}" title="${pinTitle}" aria-label="${pinTitle}">
              <svg viewBox="0 0 24 24" fill="${m.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="17" x2="12" y2="22"></line>
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
              </svg>
            </button>
            <button class="card-lock-btn ${m.locked ? 'locked' : ''}" data-lock-id="${m.id}" data-locked="${m.locked}" title="${m.locked ? 'Unlock' : 'Lock'} memory">
              ${lockIconSVG}
            </button>
          </div>
        </div>
        <div class="card-content ${m.locked ? 'locked-content' : ''}">${contentDisplay}</div>
        ${cardTagsHTML}
        <div class="card-bottom">
          <span class="card-category" data-cat="${m.category}">${emoji} ${capitalize(m.category)}</span>
          <span class="card-date">${date}</span>
        </div>
      </article>
    `;
  }

  function attachCardListeners() {
    // Lock buttons
    document.querySelectorAll('.card-lock-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        handleLockClick(btn.dataset.lockId, btn.dataset.locked === 'true');
      });
    });
    // Pin buttons
    document.querySelectorAll('.card-pin-btn').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); togglePin(btn.dataset.pinId); });
    });
    // Card tag chips
    document.querySelectorAll('.tag-chip-sm').forEach(chip => {
      chip.addEventListener('click', e => {
        e.stopPropagation();
        filterTag = chip.dataset.tag;
        fetchMemories();
      });
    });
    // Card click → view
    document.querySelectorAll('.memory-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.card-actions, .card-drag-handle, .tag-chip-sm, a')) return;
        const mem = allMemories.find(m => m.id === card.dataset.id);
        if (!mem) return;
        if (mem.locked) {
          actionTargetMemoryId = mem.id;
          isPermanentUnlock = false;
          pinEntryOverlay.classList.add('active');
          enterPinInput.focus();
        } else {
          openViewModal(mem);
        }
      });
    });
  }

  // --- Drag & Drop ---
  function attachDragHandlers() {
    document.querySelectorAll('.memory-card[draggable]').forEach(card => {
      card.addEventListener('dragstart', e => {
        dragSrcId = card.dataset.id;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.memory-card').forEach(c => c.classList.remove('drag-over'));
      });
      card.addEventListener('dragover', e => {
        e.preventDefault();
        if (card.dataset.id !== dragSrcId) {
          document.querySelectorAll('.memory-card').forEach(c => c.classList.remove('drag-over'));
          card.classList.add('drag-over');
        }
      });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', e => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const tgtId = card.dataset.id;
        if (dragSrcId === tgtId) return;
        const srcIdx = allMemories.findIndex(m => m.id === dragSrcId);
        const tgtIdx = allMemories.findIndex(m => m.id === tgtId);
        if (srcIdx === -1 || tgtIdx === -1) return;
        const reordered = [...allMemories];
        const [moved] = reordered.splice(srcIdx, 1);
        reordered.splice(tgtIdx, 0, moved);
        allMemories = reordered;
        render();
        saveReorder(reordered);
      });
    });
  }

  // --- Infinite Scroll ---
  function initInfiniteScroll() {
    if (!scrollSentinel) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
        loadMore();
      }
    }, { rootMargin: '200px' });
    observer.observe(scrollSentinel);
  }

  // --- Form Tag Input ---
  function renderFormTags() {
    if (!formTagPills) return;
    formTagPills.innerHTML = formTags.map(t => `
      <span class="form-tag-pill">
        #${escapeHtml(t)}
        <button type="button" class="form-tag-pill-remove" data-remove="${escapeHtml(t)}" aria-label="Remove tag ${t}">&times;</button>
      </span>
    `).join('');
    formTagPills.querySelectorAll('.form-tag-pill-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        formTags = formTags.filter(t => t !== btn.dataset.remove);
        renderFormTags();
      });
    });
  }

  function addTag(raw) {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!tag || formTags.includes(tag) || formTags.length >= 10) return;
    formTags.push(tag);
    renderFormTags();
  }

  if (tagTextInput) {
    tagTextInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addTag(tagTextInput.value);
        tagTextInput.value = '';
      }
      if (e.key === 'Backspace' && tagTextInput.value === '' && formTags.length > 0) {
        formTags.pop();
        renderFormTags();
      }
    });
    tagTextInput.addEventListener('blur', () => {
      if (tagTextInput.value.trim()) {
        addTag(tagTextInput.value);
        tagTextInput.value = '';
      }
    });
  }

  // --- Tabs ---
  function setTab(isWrite) {
    if (isWrite) {
      tabWrite.classList.add('active');
      tabPreview.classList.remove('active');
      contentInput.style.display = 'block';
      contentPreview.style.display = 'none';
    } else {
      tabWrite.classList.remove('active');
      tabPreview.classList.add('active');
      contentInput.style.display = 'none';
      contentPreview.style.display = 'block';
      contentPreview.innerHTML = renderMarkdown(contentInput.value);
    }
  }
  if (tabWrite) tabWrite.addEventListener('click', () => setTab(true));
  if (tabPreview) tabPreview.addEventListener('click', () => setTab(false));

  // --- Voice-to-Text (SpeechRecognition) ---
  (function initVoiceInput() {
    const micBtn = document.getElementById('mic-btn');
    const micIconDefault = document.getElementById('mic-icon-default');
    const micIconStop = document.getElementById('mic-icon-stop');
    const micBadge = document.getElementById('mic-listening-badge');

    if (!micBtn) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Browser doesn't support it — dim the button and add a tooltip
      micBtn.disabled = true;
      micBtn.title = 'Voice input is not supported in this browser. Try Chrome or Edge.';
      micBtn.style.opacity = '0.4';
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;       // keep listening until stopped
    recognition.interimResults = true;   // show partial results live
    recognition.lang = 'en-US';

    let isListening = false;
    let interimSpan = null; // tracks the live "in-progress" text node

    function setListening(active) {
      isListening = active;
      micBtn.classList.toggle('mic-active', active);
      micIconDefault.style.display = active ? 'none' : '';
      micIconStop.style.display = active ? '' : 'none';
      micBadge.style.display = active ? 'flex' : 'none';
    }

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      interimSpan = null;
    };
    recognition.onerror = (e) => {
      setListening(false);
      interimSpan = null;
      if (e.error !== 'aborted') {
        showToast(`Mic error: ${e.error}`, 'error');
      }
    };

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript + ' ';
        } else {
          interim += transcript;
        }
      }

      if (finalText) {
        // Append committed text to the textarea
        const current = contentInput.value;
        const spacer = current && !current.endsWith(' ') && !current.endsWith('\n') ? ' ' : '';
        contentInput.value = current + spacer + finalText.trim() + ' ';
        // Update char count
        charCount.textContent = `${contentInput.value.length} / 2000`;
        // Switch to Write tab to show result
        setTab(true);
      }

      // Show interim text as a placeholder in the badge
      if (interim) {
        micBadge.innerHTML = `<span class="mic-pulse"></span> <em>${interim}</em>`;
      } else {
        micBadge.innerHTML = `<span class="mic-pulse"></span> Listening…`;
      }
    };

    micBtn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
      } else {
        // Make sure we're on the Write tab
        setTab(true);
        contentInput.focus();
        recognition.start();
      }
    });
  })();

  // --- Modals ---
  function openCreateModal() {
    modalTitle.textContent = 'New Memory';
    memoryIdInput.value = '';
    titleInput.value = '';
    contentInput.value = '';
    categoryInput.value = 'personal';
    charCount.textContent = '0 / 2000';
    formTags = [];
    renderFormTags();
    if (tagTextInput) tagTextInput.value = '';
    setTab(true);
    modalOverlay.classList.add('active');
    titleInput.focus();
  }

  function openEditModal(memory) {
    modalTitle.textContent = 'Edit Memory';
    memoryIdInput.value = memory.id;
    titleInput.value = memory.title;
    contentInput.value = memory.content;
    categoryInput.value = memory.category;
    charCount.textContent = `${memory.content.length} / 2000`;
    formTags = Array.isArray(memory.tags) ? [...memory.tags] : [];
    renderFormTags();
    if (tagTextInput) tagTextInput.value = '';
    setTab(true);
    modalOverlay.classList.add('active');
    titleInput.focus();
  }

  function closeFormModal() { modalOverlay.classList.remove('active'); }

  function openViewModal(memory) {
    currentViewMemory = memory;
    const categoryEmojis = { personal:'💜', work:'💼', ideas:'💡', secrets:'🤫', important:'⭐' };
    const emoji = categoryEmojis[memory.category] || '📝';
    viewModalTitle.textContent = memory.title;
    viewCategory.innerHTML = `<span class="card-category" data-cat="${memory.category}">${emoji} ${capitalize(memory.category)}</span>`;
    
    const tags = memory.tags || [];
    if (viewTagsEl) {
      viewTagsEl.innerHTML = tags.map(t => `<button class="tag-chip" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('');
      viewTagsEl.querySelectorAll('.tag-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          filterTag = chip.dataset.tag;
          closeViewModal();
          fetchMemories();
        });
      });
    }
    
    // Render Markdown in View Modal
    viewContent.innerHTML = renderMarkdown(memory.content);
    viewContent.classList.add('markdown-body');
    
    viewMeta.textContent = `Created ${formatDateFull(memory.createdAt)} · Updated ${formatDateFull(memory.updatedAt)}`;
    viewOverlay.classList.add('active');
  }

  function closeViewModal() { viewOverlay.classList.remove('active'); currentViewMemory = null; }

  function isAnyModalOpen() {
    return modalOverlay.classList.contains('active') ||
      viewOverlay.classList.contains('active') ||
      pinSetupOverlay.classList.contains('active') ||
      pinEntryOverlay.classList.contains('active');
  }

  function showConfirm(title, message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `<div class="confirm-dialog"><h3>${title}</h3><p>${message}</p><div class="confirm-actions"><button class="btn btn-secondary" id="confirm-no">Cancel</button><button class="btn btn-danger" id="confirm-yes">Delete</button></div></div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#confirm-yes').addEventListener('click', () => { document.body.removeChild(overlay); resolve(true); });
      overlay.querySelector('#confirm-no').addEventListener('click', () => { document.body.removeChild(overlay); resolve(false); });
      overlay.addEventListener('click', e => { if (e.target === overlay) { document.body.removeChild(overlay); resolve(false); } });
    });
  }

  function showToast(message, type = 'info') {
    const icons = { success:'✅', error:'❌', info:'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span> ${escapeHtml(message)}`;
    toastContainer.appendChild(toast);
    setTimeout(() => { toast.classList.add('toast-out'); toast.addEventListener('animationend', () => toast.remove()); }, 2800);
  }

  // --- Utilities ---
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
  function formatDate(iso) {
    const d = new Date(iso), now = new Date(), diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff/86400000)}d ago`;
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
  }
  function formatDateFull(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }
  function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  // --- PIN Modals ---
  if (pinSetupClose) pinSetupClose.addEventListener('click', () => pinSetupOverlay.classList.remove('active'));
  if (pinEntryClose) pinEntryClose.addEventListener('click', () => pinEntryOverlay.classList.remove('active'));

  if (pinSetupForm) {
    pinSetupForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!actionTargetMemoryId) return;
      const pin = newPinInput.value;
      try {
        const res = await fetch(`/api/memories/${actionTargetMemoryId}/lock`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin })
        });
        if (!res.ok) throw new Error();
        showToast('Memory locked 🔒', 'success');
        pinSetupOverlay.classList.remove('active');
        newPinInput.value = '';
        fetchMemories();
      } catch { showToast('Failed to lock memory', 'error'); }
    });
  }

  if (pinEntryForm) {
    pinEntryForm.addEventListener('submit', async e => {
      e.preventDefault();
      if (!actionTargetMemoryId) return;
      const pin = enterPinInput.value;
      try {
        const url = isPermanentUnlock
          ? `/api/memories/${actionTargetMemoryId}/unlock`
          : `/api/memories/${actionTargetMemoryId}/verify`;
        const res = await fetch(url, {
          method: isPermanentUnlock ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin })
        });
        if (!res.ok) throw new Error('Invalid PIN');
        pinEntryOverlay.classList.remove('active');
        enterPinInput.value = '';
        if (isPermanentUnlock) {
          showToast('Memory unlocked 🔓', 'success');
          fetchMemories();
        } else {
          const mem = await res.json();
          openViewModal({ ...mem, locked: false });
        }
      } catch { showToast('Invalid PIN', 'error'); }
    });
  }

  // --- Event Listeners ---
  fabAdd.addEventListener('click', openCreateModal);

  memoryForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (tagTextInput && tagTextInput.value.trim()) {
      addTag(tagTextInput.value);
      tagTextInput.value = '';
    }
    const data = {
      title: titleInput.value,
      content: contentInput.value,
      category: categoryInput.value,
      tags: formTags
    };
    const editId = memoryIdInput.value;
    if (editId) {
      const result = await updateMemory(editId, data);
      if (result) { showToast('Memory updated ✨', 'success'); fetchMemories(); }
    } else {
      await createMemory(data);
    }
    closeFormModal();
  });

  contentInput.addEventListener('input', () => { charCount.textContent = `${contentInput.value.length} / 2000`; });
  btnCancel.addEventListener('click', closeFormModal);
  modalClose.addEventListener('click', closeFormModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeFormModal(); });

  viewModalClose.addEventListener('click', closeViewModal);
  viewOverlay.addEventListener('click', e => { if (e.target === viewOverlay) closeViewModal(); });

  viewEditBtn.addEventListener('click', () => {
    if (currentViewMemory) { 
      const mem = currentViewMemory;
      closeViewModal(); 
      openEditModal(mem); 
    }
  });
  viewDeleteBtn.addEventListener('click', async () => {
    if (!currentViewMemory) return;
    const memId = currentViewMemory.id;
    const confirmed = await showConfirm('Delete Memory?', 'This cannot be undone.');
    if (confirmed) { closeViewModal(); deleteMemory(memId); }
  });

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      sortBy = sortSelect.value;
      fetchMemories();
    });
  }
  if (tagClearBtn) {
    tagClearBtn.addEventListener('click', () => {
      filterTag = null;
      fetchMemories();
    });
  }

  catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      catButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      searchInput.value = '';
      searchQuery = '';
      searchClear.classList.remove('visible');
      if (searchKbd) searchKbd.style.display = '';
      fetchMemories();
    });
  });

  const debouncedSearch = debounce(() => {
    searchQuery = searchInput.value.trim();
    if (searchQuery) {
      catButtons.forEach(b => b.classList.remove('active'));
      document.querySelector('[data-category="all"]').classList.add('active');
      activeCategory = 'all';
      filterDate = null; // clear date filter on text search
      if (heatmapClearBtn) heatmapClearBtn.style.display = 'none';
    }
    fetchMemories();
  }, 300);

  searchInput.addEventListener('input', () => {
    const hasVal = searchInput.value.length > 0;
    searchClear.classList.toggle('visible', hasVal);
    if (searchKbd) searchKbd.style.display = hasVal ? 'none' : '';
    debouncedSearch();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = ''; searchQuery = '';
    searchClear.classList.remove('visible');
    if (searchKbd) searchKbd.style.display = '';
    fetchMemories(); searchInput.focus();
  });

  if (emptySearchClear) {
    emptySearchClear.addEventListener('click', () => {
      searchInput.value = ''; searchQuery = '';
      searchClear.classList.remove('visible');
      if (searchKbd) searchKbd.style.display = '';
      filterTag = null;
      filterDate = null;
      if (heatmapClearBtn) heatmapClearBtn.style.display = 'none';
      fetchMemories(); searchInput.focus();
    });
  }

  // --- Keyboard Shortcuts ---
  document.addEventListener('keydown', e => {
    const appVisible = document.getElementById('app-wrapper') &&
      !document.getElementById('app-wrapper').classList.contains('hidden');
    if (!appVisible) return;
    const tag = document.activeElement.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === 'Escape') {
      closeFormModal(); closeViewModal();
      if (pinSetupOverlay) pinSetupOverlay.classList.remove('active');
      if (pinEntryOverlay) pinEntryOverlay.classList.remove('active');
      if (document.activeElement === searchInput) searchInput.blur();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchInput.focus(); searchInput.select(); return; }
    if (isTyping) return;

    if (viewOverlay.classList.contains('active')) {
      if ((e.key === 'e' || e.key === 'E') && currentViewMemory) {
        e.preventDefault();
        const mem = currentViewMemory;
        closeViewModal();
        openEditModal(mem);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && currentViewMemory) {
        e.preventDefault();
        const memId = currentViewMemory.id;
        showConfirm('Delete Memory?', 'This cannot be undone.').then(ok => {
          if (ok) { closeViewModal(); deleteMemory(memId); }
        });
        return;
      }
    }
    if (isAnyModalOpen()) return;

    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openCreateModal(); return; }
    if (e.key === '/') { e.preventDefault(); searchInput.focus(); return; }
  });

  // --- Landing Page Logic ---
  const landingPage = document.getElementById('landing-page');
  const appWrapper = document.getElementById('app-wrapper');
  const heroEnterBtn = document.getElementById('hero-enter-btn');
  const navEnterBtn = document.getElementById('nav-enter-btn');
  const landingNav = document.getElementById('landing-nav');

  function enterVault() {
    landingPage.classList.add('leaving');
    setTimeout(() => {
      landingPage.style.display = 'none';
      landingNav.style.display = 'none';
      appWrapper.classList.remove('hidden');
      appWrapper.classList.add('entering');
      void appWrapper.offsetHeight;
      appWrapper.classList.add('visible');
      appWrapper.classList.remove('entering');
      fetchMemories();
      initInfiniteScroll();
    }, 700);
  }

  heroEnterBtn.addEventListener('click', enterVault);
  navEnterBtn.addEventListener('click', enterVault);

  window.addEventListener('scroll', () => {
    if (!landingPage || landingPage.style.display === 'none') return;
    landingNav.classList.toggle('scrolled', window.scrollY > 60);
  });

  // --- Init ---
  initTheme();
  initParticles();

  // --- Stats Dashboard ---
  (function initStats() {
    const statsBtn     = document.getElementById('stats-btn');
    const statsPanel   = document.getElementById('stats-panel');
    const statsClose   = document.getElementById('stats-close');
    const statsBackdrop = document.getElementById('stats-backdrop');
    if (!statsBtn || !statsPanel) return;

    const CAT_META = {
      personal:  { label: 'Personal',  emoji: '💜', color: '#a78bfa' },
      work:      { label: 'Work',       emoji: '💼', color: '#38bdf8' },
      ideas:     { label: 'Ideas',      emoji: '💡', color: '#fbbf24' },
      secrets:   { label: 'Secrets',    emoji: '🤫', color: '#f472b6' },
      important: { label: 'Important',  emoji: '⭐', color: '#fb923c' }
    };

    function openStats() {
      statsPanel.classList.add('open');
      statsBackdrop.classList.add('open');
      loadStats();
    }
    function closeStats() {
      statsPanel.classList.remove('open');
      statsBackdrop.classList.remove('open');
    }

    statsBtn.addEventListener('click', openStats);
    statsClose.addEventListener('click', closeStats);
    statsBackdrop.addEventListener('click', closeStats);

    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        const s = await res.json();
        renderStats(s);
      } catch (e) {
        showToast('Could not load stats', 'error');
      }
    }

    function animateValue(el, target) {
      // Count-up animation
      const duration = 600;
      const start = Date.now();
      const from = 0;
      function tick() {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        el.textContent = Math.round(from + (target - from) * ease);
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    function renderStats(s) {
      // Summary cards
      const cardTotal  = document.querySelector('#stat-total .stat-value');
      const cardWeek   = document.querySelector('#stat-week .stat-value');
      const cardLocked = document.querySelector('#stat-locked .stat-value');
      const cardAvg    = document.querySelector('#stat-avg .stat-value');

      if (cardTotal)  animateValue(cardTotal, s.total);
      if (cardWeek)   animateValue(cardWeek, s.thisWeek);
      if (cardLocked) animateValue(cardLocked, s.locked);
      if (cardAvg)    animateValue(cardAvg, s.avgLength);

      // Category bar chart
      const barsEl = document.getElementById('stats-category-bars');
      if (barsEl) {
        const maxCount = Math.max(1, ...Object.values(s.categories));
        const allCats = ['personal', 'work', 'ideas', 'secrets', 'important'];
        barsEl.innerHTML = allCats.map(cat => {
          const count = s.categories[cat] || 0;
          const pct = Math.round((count / maxCount) * 100);
          const meta = CAT_META[cat] || { label: cat, emoji: '📝', color: '#94a3b8' };
          return `
            <div class="cat-bar-row">
              <div class="cat-bar-label">
                <span>${meta.emoji}</span>
                <span>${meta.label}</span>
              </div>
              <div class="cat-bar-track">
                <div class="cat-bar-fill" style="width:0%; background:${meta.color};" data-pct="${pct}"></div>
              </div>
              <div class="cat-bar-count">${count}</div>
            </div>`;
        }).join('');

        // Animate bars in after paint
        requestAnimationFrame(() => {
          barsEl.querySelectorAll('.cat-bar-fill').forEach(bar => {
            requestAnimationFrame(() => { bar.style.width = bar.dataset.pct + '%'; });
          });
        });
      }

      // Top tags
      const tagsEl = document.getElementById('stats-top-tags');
      const tagsSection = document.getElementById('stats-tags-section');
      if (tagsEl) {
        if (s.topTags && s.topTags.length) {
          tagsSection.style.display = '';
          const maxTag = s.topTags[0]?.count || 1;
          tagsEl.innerHTML = s.topTags.map(t => `
            <div class="stats-tag-row">
              <span class="tag-chip">#${escapeHtml(t.name)}<span class="tag-count">${t.count}</span></span>
              <div class="tag-bar-track">
                <div class="tag-bar-fill" style="width:${Math.round(t.count / maxTag * 100)}%"></div>
              </div>
            </div>
          `).join('');
        } else {
          tagsSection.style.display = 'none';
        }
      }

      // Fun facts
      const factsEl = document.getElementById('stats-facts');
      if (factsEl) {
        const facts = [];
        if (s.mostActiveDay) {
          const d = new Date(s.mostActiveDay.date + 'T12:00:00');
          const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          facts.push(`🏆 Most active day: <strong>${label}</strong> (${s.mostActiveDay.count} memories)`);
        }
        if (s.pinned > 0) {
          facts.push(`📌 <strong>${s.pinned}</strong> pinned memor${s.pinned === 1 ? 'y' : 'ies'}`);
        }
        if (s.longestTitle) {
          facts.push(`📝 Longest title: <em>"${escapeHtml(s.longestTitle)}"</em>`);
        }
        if (s.total === 0) {
          facts.push('✨ Your vault is empty — add your first memory!');
        }
        factsEl.innerHTML = facts.map(f => `<div class="stats-fact">${f}</div>`).join('');
      }
    }
  })();

})();