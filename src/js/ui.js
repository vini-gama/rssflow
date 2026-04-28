/**
 * FeedFlow — UI Module
 * Handles all DOM rendering and UI interactions.
 */

const UI = (() => {

  // ── Toast ─────────────────────────────────────────────────
  const toast = (msg, type = 'info', duration = 3500) => {
    const container = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-dot"></span>${msg}`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, duration);
  };

  // ── Feed Status ───────────────────────────────────────────
  const setStatus = (msg, type = '') => {
    const el = document.getElementById('feedStatus');
    el.textContent = msg;
    el.className = `feed-status ${type}`;
  };

  const clearStatus = () => setStatus('');

  // ── Feed List ─────────────────────────────────────────────
  const renderFeedList = (feeds, activeFeedId, callbacks) => {
    const list  = document.getElementById('feedList');
    const count = document.getElementById('feedCount');
    count.textContent = feeds.length;

    if (feeds.length === 0) {
      list.innerHTML = `
        <li class="feed-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>
          Nenhuma inscrição ainda
        </li>`;
      return;
    }

    const readIds    = Storage.getReadIds();
    const articles   = Storage.getArticles();

    list.innerHTML = feeds.map(feed => {
      const unread = articles.filter(a => a.feedId === feed.id && !readIds.has(a.id)).length;
      const isActive = feed.id === activeFeedId;
      const faviconHtml = feed.favicon
        ? `<img class="feed-favicon" src="${feed.favicon}" alt="" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
        : '';
      const fallback = `<span class="feed-favicon-fallback" ${feed.favicon ? 'style="display:none"' : ''}>${(feed.title || '?').charAt(0).toUpperCase()}</span>`;

      return `
        <li class="feed-item ${isActive ? 'active' : ''}" data-id="${feed.id}">
          ${faviconHtml}${fallback}
          <div class="feed-info">
            <div class="feed-name">${escHtml(feed.title || feed.siteUrl)}</div>
            <div class="feed-url-hint">${extractHost(feed.siteUrl || feed.feedUrl)}</div>
          </div>
          ${unread > 0 ? `<span class="feed-unread">${unread > 99 ? '99+' : unread}</span>` : ''}
          <div class="feed-item-actions">
            <button class="btn-feed-action btn-delete-feed" data-id="${feed.id}" title="Remover feed">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>
          </div>
        </li>`;
    }).join('');

    // Bind click events
    list.querySelectorAll('.feed-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-feed-action')) return;
        callbacks.onSelect(item.dataset.id);
      });
    });
    list.querySelectorAll('.btn-delete-feed').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onDelete(btn.dataset.id);
      });
    });
  };

  // ── Articles ──────────────────────────────────────────────
  const renderArticles = (articles, filter, callbacks) => {
    const grid  = document.getElementById('articlesGrid');
    const empty = document.getElementById('emptyState');
    const feeds = Storage.getFeeds();
    const feedMap = Object.fromEntries(feeds.map(f => [f.id, f]));
    const readIds    = Storage.getReadIds();
    const starredIds = Storage.getStarredIds();

    let filtered = articles;
    if (filter === 'unread')  filtered = articles.filter(a => !readIds.has(a.id));
    if (filter === 'starred') filtered = articles.filter(a => starredIds.has(a.id));

    if (filtered.length === 0 && feeds.length === 0) {
      empty.style.display = 'flex';
      grid.style.display  = 'none';
      return;
    }

    empty.style.display = 'none';
    grid.style.display  = 'grid';

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-3);font-size:.875rem">Nenhum artigo nesta visualização.</div>`;
      return;
    }

    grid.innerHTML = filtered.slice(0, 100).map(a => {
      const feed = feedMap[a.feedId] || {};
      const isRead    = readIds.has(a.id);
      const isStarred = starredIds.has(a.id);
      const dateStr   = formatDate(a.date);
      const faviconHtml = feed.favicon
        ? `<img class="card-favicon" src="${feed.favicon}" alt="" onerror="this.style.display='none'">`
        : '';

      return `
        <article class="article-card ${isRead ? 'read' : ''}" data-id="${a.id}" data-link="${escHtml(a.link)}">
          ${a.image ? `<img class="card-thumb" src="${escHtml(a.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
          <div class="card-source">
            ${faviconHtml}
            <span class="card-source-name">${escHtml(feed.title || 'Feed')}</span>
            <span class="card-date">${dateStr}</span>
            ${!isRead ? '<span class="card-unread-dot"></span>' : ''}
          </div>
          <div class="card-title">${escHtml(a.title)}</div>
          ${a.summary ? `<div class="card-summary">${escHtml(a.summary)}</div>` : ''}
          <div class="card-footer">
            <span class="card-tag">${escHtml(a.categories?.[0] || extractHost(feed.siteUrl || ''))}</span>
            <button class="card-star-btn ${isStarred ? 'starred' : ''}" data-id="${a.id}" title="${isStarred ? 'Remover dos salvos' : 'Salvar'}">
              <svg viewBox="0 0 24 24" fill="${isStarred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
          </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('.article-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-star-btn')) return;
        callbacks.onOpen(card.dataset.id);
      });
    });
    grid.querySelectorAll('.card-star-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        callbacks.onStar(btn.dataset.id, btn);
      });
    });
  };

  // ── Article Modal ─────────────────────────────────────────
  const openModal = (articleId, callbacks) => {
    const articles = Storage.getArticles();
    const a = articles.find(x => x.id === articleId);
    if (!a) return;

    const feeds   = Storage.getFeeds();
    const feed    = feeds.find(f => f.id === a.feedId) || {};
    const starred = Storage.getStarredIds().has(a.id);

    const overlay  = document.getElementById('modalOverlay');
    const metaEl   = document.getElementById('modalMeta');
    const bodyEl   = document.getElementById('modalBody');
    const openLink = document.getElementById('btnModalOpen');
    const starBtn  = document.getElementById('btnModalStar');

    metaEl.innerHTML = `
      <span>${escHtml(feed.title || 'Feed')}</span>
      <span>·</span>
      <span>${formatDate(a.date)}</span>`;

    openLink.href = a.link;
    starBtn.dataset.id = a.id;
    starBtn.querySelector('svg').setAttribute('fill', starred ? 'currentColor' : 'none');

    bodyEl.innerHTML = `
      <div class="modal-feed-name">${escHtml(feed.title || '')}</div>
      <h1 class="modal-title">${escHtml(a.title)}</h1>
      <span class="modal-date">${formatDateFull(a.date)}</span>
      ${a.image ? `<img class="modal-thumb" src="${escHtml(a.image)}" alt="" onerror="this.remove()">` : ''}
      <div class="modal-content">${sanitizeContent(a.content || a.summary || '<p>Sem conteúdo.</p>')}</div>
      <a class="modal-read-more" href="${escHtml(a.link)}" target="_blank" rel="noopener">
        Ler no site original
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      </a>`;

    overlay.classList.add('open');
    Storage.markRead(a.id);
    if (callbacks) callbacks.onRead(a.id);
  };

  const closeModal = () => {
    document.getElementById('modalOverlay').classList.remove('open');
  };

  // ── Loading ───────────────────────────────────────────────
  const showLoading = () => {
    document.getElementById('loadingState').style.display = 'flex';
    document.getElementById('articlesGrid').style.display = 'none';
    document.getElementById('emptyState').style.display  = 'none';
  };

  const hideLoading = () => {
    document.getElementById('loadingState').style.display = 'none';
  };

  // ── Helpers ───────────────────────────────────────────────
  const escHtml = (str = '') =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const sanitizeContent = (html) => {
    // Allow basic formatting but strip scripts/iframes
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '');
  };

  const extractHost = (url) => {
    try { return new URL(url).hostname.replace('www.', ''); }
    catch { return url; }
  };

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now - d;
      if (diff < 3600000)  return `${Math.round(diff / 60000)}m`;
      if (diff < 86400000) return `${Math.round(diff / 3600000)}h`;
      if (diff < 604800000) return `${Math.round(diff / 86400000)}d`;
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch { return ''; }
  };

  const formatDateFull = (iso) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ''; }
  };

  return {
    toast, setStatus, clearStatus,
    renderFeedList, renderArticles,
    openModal, closeModal,
    showLoading, hideLoading,
    escHtml, extractHost,
  };
})();
