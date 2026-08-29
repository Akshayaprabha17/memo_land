/* ============================================
   MEMORY LOCK — Client Application Logic
   ============================================ */

(function () {
  'use strict';

  // --- State ---
  let memories = [];
  let activeCategory = 'all';
  let searchQuery = '';
  let currentViewMemory = null;
  let currentPin = null;
  let inactivityTimer = null;
  let isVaultPinSet = false;

  // --- DOM Elements ---
  const grid = document.getElementById('memory-grid');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const countNumber = document.getElementById('count-number');
  const fabAdd = document.getElementById('fab-add');
  const catButtons = document.querySelectorAll('.cat-btn');

  // Form Modal
  const modalOverlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const memoryForm = document.getElementById('memory-form');
  const memoryIdInput = document.getElementById('memory-id');
  const titleInput = document.getElementById('memory-title-input');
  const contentInput = document.getElementById('memory-content-input');
  const categoryInput = document.getElementById('memory-category-input');
  const charCount = document.getElementById('char-count');
  const btnCancel = document.getElementById('btn-cancel');
  const modalClose = document.getElementById('modal-close');

  // View Modal
  const viewOverlay = document.getElementById('view-modal-overlay');
  const viewModalTitle = document.getElementById('view-modal-title');
  const viewCategory = document.getElementById('view-category');
  const viewContent = document.getElementById('view-content');
  const viewMeta = document.getElementById('view-meta');
  const viewModalClose = document.getElementById('view-modal-close');
  const viewEditBtn = document.getElementById('view-edit-btn');
  const viewDeleteBtn = document.getElementById('view-delete-btn');

  // Toast
  const toastContainer = document.getElementById('toast-container');

  // PIN Modals
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

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5,
        alpha: Math.random() * 0.3 + 0.05,
        color: ['124,58,237', '167,139,250', '245,158,11', '14,165,233'][Math.floor(Math.random() * 4)]
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.fill();
      });
      requestAnimationFrame(animate);
    }
    animate();
  }

  // --- Security & Activity ---
  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(currentPin ? { 'X-Vault-PIN': currentPin } : {})
    };
  }

  function lockVault() {
    if (currentPin) {
      currentPin = null;
      showToast('Vault locked instantly', 'info');
      closeFormModal();
      closeViewModal();
      pinEntryOverlay.classList.remove('active');
      pinSetupOverlay.classList.remove('active');
      fetchMemories();
    }
  }

  function resetInactivityTimer() {
    if (!currentPin) return; // Only timer if unlocked
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      currentPin = null;
      showToast('Vault auto-locked due to inactivity', 'info');
      closeFormModal();
      closeViewModal();
      fetchMemories();
    }, 60000); // 60 seconds
  }

  let throttleTimer = false;
  function handleActivity() {
    if (throttleTimer) return;
    throttleTimer = true;
    setTimeout(() => { throttleTimer = false; }, 1000);
    resetInactivityTimer();
  }

  // Activity listeners to reset timer
  ['mousemove', 'keydown', 'scroll', 'click'].forEach(evt => {
    window.addEventListener(evt, handleActivity);
  });

  async function checkPinStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      isVaultPinSet = data.isPinSet;
    } catch (e) {
      console.error('Failed to check pin status', e);
    }
  }

  // --- API Helpers ---
  async function fetchMemories() {
    try {
      let url = '/api/memories';
      if (searchQuery) {
        url = `/api/memories/search?q=${encodeURIComponent(searchQuery)}`;
      } else if (activeCategory !== 'all') {
        url += `?category=${activeCategory}`;
      }
      const res = await fetch(url, { headers: getHeaders() });
      memories = await res.json();
      render();
    } catch (err) {
      showToast('Failed to load memories', 'error');
    }
  }

  async function createMemory(data) {
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Create failed');
      }
      showToast('Memory saved ✨', 'success');
      fetchMemories();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function updateMemory(id, data) {
    try {
      const res = await fetch(`/api/memories/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Update failed');
      }
      return await res.json();
    } catch (err) {
      showToast(err.message, 'error');
      return null;
    }
  }

  async function deleteMemory(id) {
    try {
      const res = await fetch(`/api/memories/${id}`, { 
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Delete failed');
      }
      showToast('Memory erased 🗑️', 'info');
      fetchMemories();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function toggleLock(id, currentLocked) {
    if (!currentLocked && !isVaultPinSet) {
      pinSetupOverlay.classList.add('active');
      newPinInput.focus();
      return;
    }
    
    if (currentLocked && !currentPin) {
       pinEntryOverlay.classList.add('active');
       enterPinInput.focus();
       return;
    }

    const result = await updateMemory(id, { locked: !currentLocked });
    if (result) {
      showToast(result.locked ? 'Memory locked 🔒' : 'Memory unlocked 🔓', 'success');
      fetchMemories();
    }
  }

  // --- Rendering ---
  function render() {
    countNumber.textContent = memories.length;

    if (memories.length === 0) {
      grid.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }
    emptyState.style.display = 'none';

    grid.innerHTML = memories.map((m, i) => {
      const categoryEmojis = {
        personal: '💜', work: '💼', ideas: '💡', secrets: '🤫', important: '⭐'
      };
      const emoji = categoryEmojis[m.category] || '📝';
      const date = formatDate(m.createdAt);
      const lockIconSVG = m.locked
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 5-5 5 5 0 0 1 5 5"></path><line x1="17" y1="7" x2="17" y2="4"></line></svg>`;

      const contentDisplay = m.locked
        ? '••••• This memory is locked •••••'
        : escapeHtml(m.content);

      return `
        <article class="memory-card" data-category="${m.category}" data-id="${m.id}" style="animation-delay: ${i * 0.06}s">
          <div class="card-top">
            <h3 class="card-title">${escapeHtml(m.title)}</h3>
            <button class="card-lock-btn ${m.locked ? 'locked' : ''}" data-lock-id="${m.id}" data-locked="${m.locked}" title="${m.locked ? 'Unlock' : 'Lock'} memory" aria-label="${m.locked ? 'Unlock' : 'Lock'} this memory">
              ${lockIconSVG}
            </button>
          </div>
          <p class="card-content ${m.locked ? 'locked-content' : ''}">${contentDisplay}</p>
          <div class="card-bottom">
            <span class="card-category" data-cat="${m.category}">${emoji} ${capitalize(m.category)}</span>
            <span class="card-date">${date}</span>
          </div>
        </article>
      `;
    }).join('');

    // Attach lock button listeners
    document.querySelectorAll('.card-lock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.lockId;
        const locked = btn.dataset.locked === 'true';
        toggleLock(id, locked);
      });
    });

    // Attach card click listeners (view)
    document.querySelectorAll('.memory-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const mem = memories.find(m => m.id === id);
        if (mem) {
           if (mem.locked && !currentPin) {
             pinEntryOverlay.classList.add('active');
             enterPinInput.focus();
           } else {
             openViewModal(mem);
           }
        }
      });
    });
  }

  // --- Modals ---
  function openCreateModal() {
    modalTitle.textContent = 'New Memory';
    memoryIdInput.value = '';
    titleInput.value = '';
    contentInput.value = '';
    categoryInput.value = 'personal';
    charCount.textContent = '0 / 2000';
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
    modalOverlay.classList.add('active');
    titleInput.focus();
  }

  function closeFormModal() {
    modalOverlay.classList.remove('active');
  }

  function openViewModal(memory) {
    currentViewMemory = memory;
    const categoryEmojis = {
      personal: '💜', work: '💼', ideas: '💡', secrets: '🤫', important: '⭐'
    };
    const emoji = categoryEmojis[memory.category] || '📝';

    viewModalTitle.textContent = memory.title;
    viewCategory.innerHTML = `<span class="card-category" data-cat="${memory.category}">${emoji} ${capitalize(memory.category)}</span>`;
    viewContent.textContent = memory.locked ? 'This memory is locked. Unlock it to view the content.' : memory.content;
    viewMeta.textContent = `Created ${formatDateFull(memory.createdAt)} · Updated ${formatDateFull(memory.updatedAt)}`;
    viewOverlay.classList.add('active');
  }

  function closeViewModal() {
    viewOverlay.classList.remove('active');
    currentViewMemory = null;
  }

  // --- Confirm Dialog ---
  function showConfirm(title, message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <h3>${title}</h3>
          <p>${message}</p>
          <div class="confirm-actions">
            <button class="btn btn-secondary" id="confirm-no">Cancel</button>
            <button class="btn btn-danger" id="confirm-yes">Delete</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('#confirm-yes').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(true);
      });
      overlay.querySelector('#confirm-no').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(false);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(false);
        }
      });
    });
  }

  // --- Toast ---
  function showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span> ${escapeHtml(message)}`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove());
    }, 2800);
  }

  // --- Utilities ---
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateFull(iso) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  // Debounce
  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // --- PIN Modals ---
  if (pinSetupClose) pinSetupClose.addEventListener('click', () => pinSetupOverlay.classList.remove('active'));
  if (pinEntryClose) pinEntryClose.addEventListener('click', () => pinEntryOverlay.classList.remove('active'));

  if (pinSetupForm) {
    pinSetupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = newPinInput.value;
      try {
        const res = await fetch('/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        if (!res.ok) throw new Error('Setup failed');
        isVaultPinSet = true;
        currentPin = pin;
        showToast('Master PIN set successfully', 'success');
        pinSetupOverlay.classList.remove('active');
        newPinInput.value = '';
        resetInactivityTimer();
        fetchMemories();
      } catch (e) {
        showToast('Failed to set PIN', 'error');
      }
    });
  }

  if (pinEntryForm) {
    pinEntryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = enterPinInput.value;
      try {
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        if (!res.ok) throw new Error('Invalid PIN');
        currentPin = pin;
        showToast('Vault Unlocked 🔓', 'success');
        pinEntryOverlay.classList.remove('active');
        enterPinInput.value = '';
        resetInactivityTimer();
        fetchMemories();
      } catch (e) {
        showToast('Invalid PIN', 'error');
      }
    });
  }

  // --- Event Listeners ---

  // FAB
  fabAdd.addEventListener('click', openCreateModal);

  // Form Submit
  memoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      title: titleInput.value,
      content: contentInput.value,
      category: categoryInput.value
    };
    const editId = memoryIdInput.value;
    if (editId) {
      const result = await updateMemory(editId, data);
      if (result) {
        showToast('Memory updated ✨', 'success');
        fetchMemories();
      }
    } else {
      await createMemory(data);
    }
    closeFormModal();
  });

  // Char counter
  contentInput.addEventListener('input', () => {
    charCount.textContent = `${contentInput.value.length} / 2000`;
  });

  // Modal close
  btnCancel.addEventListener('click', closeFormModal);
  modalClose.addEventListener('click', closeFormModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeFormModal();
  });

  viewModalClose.addEventListener('click', closeViewModal);
  viewOverlay.addEventListener('click', (e) => {
    if (e.target === viewOverlay) closeViewModal();
  });

  // View modal actions
  viewEditBtn.addEventListener('click', () => {
    if (currentViewMemory) {
      closeViewModal();
      openEditModal(currentViewMemory);
    }
  });

  viewDeleteBtn.addEventListener('click', async () => {
    if (!currentViewMemory) return;
    const confirmed = await showConfirm('Delete Memory?', 'This action cannot be undone. This memory will be permanently erased from your vault.');
    if (confirmed) {
      closeViewModal();
      deleteMemory(currentViewMemory.id);
    }
  });

  // Category filters
  catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      catButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.category;
      searchInput.value = '';
      searchQuery = '';
      searchClear.classList.remove('visible');
      fetchMemories();
    });
  });

  // Search
  const debouncedSearch = debounce(() => {
    searchQuery = searchInput.value.trim();
    // Reset category to "all" when searching
    if (searchQuery) {
      catButtons.forEach(b => b.classList.remove('active'));
      document.querySelector('[data-category="all"]').classList.add('active');
      activeCategory = 'all';
    }
    fetchMemories();
  }, 300);

  searchInput.addEventListener('input', () => {
    searchClear.classList.toggle('visible', searchInput.value.length > 0);
    debouncedSearch();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.classList.remove('visible');
    fetchMemories();
    searchInput.focus();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (currentPin) {
        lockVault(); // Panic mode
      } else {
        closeFormModal();
        closeViewModal();
        if (pinSetupOverlay) pinSetupOverlay.classList.remove('active');
        if (pinEntryOverlay) pinEntryOverlay.classList.remove('active');
      }
    }
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // --- Landing Page Logic ---
  const landingPage = document.getElementById('landing-page');
  const appWrapper = document.getElementById('app-wrapper');
  const heroEnterBtn = document.getElementById('hero-enter-btn');
  const navEnterBtn = document.getElementById('nav-enter-btn');
  const landingNav = document.getElementById('landing-nav');

  function enterVault() {
    // Animate landing page out
    landingPage.classList.add('leaving');

    setTimeout(() => {
      landingPage.style.display = 'none';
      landingNav.style.display = 'none';

      // Show app wrapper with animation
      appWrapper.classList.remove('hidden');
      appWrapper.classList.add('entering');

      // Trigger reflow for animation
      void appWrapper.offsetHeight;
      appWrapper.classList.add('visible');
      appWrapper.classList.remove('entering');

      // Now init the app
      checkPinStatus();
      fetchMemories();
    }, 700);
  }

  heroEnterBtn.addEventListener('click', enterVault);
  navEnterBtn.addEventListener('click', enterVault);

  // Landing nav scroll effect
  function handleLandingScroll() {
    if (!landingPage || landingPage.style.display === 'none') return;
    if (window.scrollY > 60) {
      landingNav.classList.add('scrolled');
    } else {
      landingNav.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', handleLandingScroll);

  // --- Init (particles run on landing too) ---
  initParticles();
})();

