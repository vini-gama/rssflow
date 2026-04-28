/**
 * FeedFlow — App Controller
 * Orchestrates all modules.
 */

const App = (() => {

  let state = {
    activeFeedId: null,  // null = show all feeds
    filter: 'all',
    isAdding: false,
  };

  // ── Init ──────────────────────────────────────────────────
  const init = () => {
    applyTheme(Storage.getSettings().theme);
    bindUI();
    renderAll();

    // Auto-refresh every 15 minutes
    setInterval(refreshAll, 15 * 60 * 1000);
  };

  // ── Render ────────────────────────────────────────────────
  const renderAll = () => {
    const feeds    = Storage.getFeeds();
    const articles = getFilteredArticles();

    UI.renderFeedList(feeds, state.activeFeedId, {
      onSelect: (id) => selectFeed(id),
      onDelete: (id) => deleteFeed(id),
    });

    UI.renderArticles(articles, state.filter, {
      onOpen: (id) => UI.openModal(id, { onRead: () => renderAll() }),
      onStar: (id, btn) => {
        const isNow = Storage.toggleStarred(id);
        btn.classList.toggle('starred', isNow);
        btn.querySelector('svg').setAttribute('fill', isNow ? 'currentColor' : 'none');
        if (state.filter === 'starred') renderAll();
      },
    });
  };

  const getFilteredArticles = () => {
    let articles = state.activeFeedId
      ? Storage.getArticlesByFeed(state.activeFeedId)
      : Storage.getArticles();
    return articles.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // ── Add Feed ──────────────────────────────────────────────
  const addFeed = async (rawUrl) => {
    if (state.isAdding) return;
    if (!rawUrl.trim()) {
      UI.setStatus('Por favor, insira uma URL.', 'error');
      return;
    }

    state.isAdding = true;
    const btn = document.getElementById('btnAdd');
    btn.disabled = true;

    UI.setStatus('🔍 Detectando feed...', 'loading');

    try {
      const result = await FeedDetector.detect(rawUrl, (msg) => UI.setStatus(msg, 'loading'));

      if (!result) {
        UI.setStatus('❌ Nenhum feed RSS/Atom encontrado neste site.', 'error');
        UI.toast('Nenhum feed encontrado em ' + rawUrl, 'error');
        return;
      }

      if (Storage.feedExists(result.feedUrl)) {
        UI.setStatus('⚠️ Você já está inscrito neste feed.', 'warn');
        UI.toast('Já inscrito neste feed.', 'warn');
        return;
      }

      UI.setStatus('📡 Carregando artigos...', 'loading');

      // Fetch and parse feed content
      const { text } = await FeedDetector.proxyFetch(result.feedUrl);
      const parsed   = FeedParser.parse(text, generateFeedId(result.feedUrl));

      // Build feed object
      const siteUrl  = extractSiteUrl(rawUrl, result.feedUrl);
      const feed = {
        id:       generateFeedId(result.feedUrl),
        feedUrl:  result.feedUrl,
        siteUrl,
        title:    result.title || parsed.feedTitle || UI.extractHost(siteUrl),
        favicon:  FeedDetector.getFaviconUrl(siteUrl),
        addedAt:  new Date().toISOString(),
        lastFetch: new Date().toISOString(),
      };

      Storage.saveFeed(feed);
      const newCount = Storage.saveArticles(parsed.articles);

      UI.setStatus(`✅ Inscrito! ${newCount} artigo(s) carregado(s).`, 'success');
      UI.toast(`"${feed.title}" adicionado com sucesso!`, 'success');

      document.getElementById('urlInput').value = '';
      setTimeout(() => UI.clearStatus(), 4000);
      renderAll();

    } catch (err) {
      console.error('[addFeed]', err);
      UI.setStatus('❌ Erro: ' + (err.message || 'falha desconhecida'), 'error');
      UI.toast('Erro ao adicionar feed.', 'error');
    } finally {
      state.isAdding = false;
      btn.disabled = false;
    }
  };

  // ── Delete Feed ───────────────────────────────────────────
  const deleteFeed = (feedId) => {
    const feeds = Storage.getFeeds();
    const feed  = feeds.find(f => f.id === feedId);
    if (!feed) return;

    if (!confirm(`Remover "${feed.title || feed.siteUrl}"?`)) return;

    Storage.deleteFeed(feedId);
    Storage.deleteArticlesByFeed(feedId);

    if (state.activeFeedId === feedId) state.activeFeedId = null;
    UI.toast('Feed removido.', 'info');
    renderAll();
  };

  // ── Select Feed ───────────────────────────────────────────
  const selectFeed = (feedId) => {
    state.activeFeedId = state.activeFeedId === feedId ? null : feedId;
    // On mobile, close sidebar after selecting
    if (window.innerWidth <= 768) toggleSidebar(false);
    renderAll();
  };

  // ── Refresh ───────────────────────────────────────────────
  const refreshAll = async () => {
    const feeds = Storage.getFeeds();
    if (feeds.length === 0) return;

    const btn = document.getElementById('btnRefresh');
    btn.classList.add('spinning');

    let totalNew = 0;
    for (const feed of feeds) {
      try {
        const { text } = await FeedDetector.proxyFetch(feed.feedUrl);
        const parsed   = FeedParser.parse(text, feed.id);
        const added    = Storage.saveArticles(parsed.articles);
        totalNew += added;
        // Update last fetch time
        Storage.saveFeed({ ...feed, lastFetch: new Date().toISOString() });
      } catch (e) {
        console.warn(`[refresh] ${feed.feedUrl}`, e.message);
      }
    }

    btn.classList.remove('spinning');
    if (totalNew > 0) {
      UI.toast(`${totalNew} novo(s) artigo(s) carregado(s)!`, 'success');
      renderAll();
    } else {
      UI.toast('Todos os feeds estão atualizados.', 'info');
    }
  };

  // ── OPML ──────────────────────────────────────────────────
  const exportOPML = () => {
    const feeds = Storage.getFeeds();
    if (feeds.length === 0) { UI.toast('Nenhuma inscrição para exportar.', 'warn'); return; }
    const xml = OPML.exportFeeds(feeds);
    OPML.downloadFile(xml, 'feedflow-subscriptions.opml');
    UI.toast('OPML exportado!', 'success');
  };

  const handleOPMLFile = async (file) => {
    try {
      const text   = await file.text();
      const entries = OPML.importOpml(text);
      UI.toast(`Importando ${entries.length} feed(s)...`, 'info');

      let added = 0;
      for (const entry of entries) {
        if (Storage.feedExists(entry.feedUrl)) continue;
        const feedId = generateFeedId(entry.feedUrl);
        try {
          const { text: xml } = await FeedDetector.proxyFetch(entry.feedUrl);
          const parsed = FeedParser.parse(xml, feedId);
          const feed = {
            id: feedId,
            feedUrl: entry.feedUrl,
            siteUrl: entry.siteUrl || entry.feedUrl,
            title:   entry.title || parsed.feedTitle || UI.extractHost(entry.siteUrl),
            favicon: FeedDetector.getFaviconUrl(entry.siteUrl || entry.feedUrl),
            addedAt: new Date().toISOString(),
            lastFetch: new Date().toISOString(),
          };
          Storage.saveFeed(feed);
          Storage.saveArticles(parsed.articles);
          added++;
        } catch { /* skip errored feeds */ }
      }

      UI.toast(`${added} feed(s) importado(s) com sucesso!`, 'success');
      renderAll();
    } catch (e) {
      UI.toast('Erro ao importar OPML: ' + e.message, 'error');
    }
  };

  // ── Theme ─────────────────────────────────────────────────
  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    const moon = document.querySelector('.icon-moon');
    const sun  = document.querySelector('.icon-sun');
    if (theme === 'light') {
      moon.style.display = 'none';
      sun.style.display  = 'block';
    } else {
      moon.style.display = 'block';
      sun.style.display  = 'none';
    }
  };

  const toggleTheme = () => {
    const current = Storage.getSettings().theme;
    const next    = current === 'dark' ? 'light' : 'dark';
    Storage.saveSettings({ theme: next });
    applyTheme(next);
  };

  // ── Sidebar ───────────────────────────────────────────────
  const toggleSidebar = (force) => {
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = sidebar.classList.contains('collapsed');
    const open = force !== undefined ? force : isCollapsed;
    sidebar.classList.toggle('collapsed', !open);
  };

  // ── Bind Events ───────────────────────────────────────────
  const bindUI = () => {
    // Add feed
    document.getElementById('btnAdd').addEventListener('click', () => {
      addFeed(document.getElementById('urlInput').value);
    });
    document.getElementById('urlInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addFeed(e.target.value);
    });

    // Example URLs
    document.querySelectorAll('.example-url').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('urlInput').value = btn.dataset.url;
        addFeed(btn.dataset.url);
      });
    });

    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.filter = btn.dataset.filter;
        renderAll();
      });
    });

    // Refresh
    document.getElementById('btnRefresh').addEventListener('click', refreshAll);

    // Mark all read
    document.getElementById('btnMarkAllRead').addEventListener('click', () => {
      Storage.markAllRead(state.activeFeedId || null);
      UI.toast('Todos marcados como lidos.', 'success');
      renderAll();
    });

    // Theme
    document.getElementById('btnToggleTheme').addEventListener('click', toggleTheme);

    // Sidebar
    document.getElementById('menuBtn').addEventListener('click', () => toggleSidebar());
    document.getElementById('sidebarToggle').addEventListener('click', () => toggleSidebar(false));

    // Modal
    document.getElementById('btnModalClose').addEventListener('click', UI.closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) UI.closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') UI.closeModal();
    });

    // Modal star
    document.getElementById('btnModalStar').addEventListener('click', (e) => {
      const id  = e.currentTarget.dataset.id;
      const now = Storage.toggleStarred(id);
      e.currentTarget.querySelector('svg').setAttribute('fill', now ? 'currentColor' : 'none');
      renderAll();
    });

    // OPML
    document.getElementById('btnExportOPML').addEventListener('click', exportOPML);
    document.getElementById('btnImportOPML').addEventListener('click', () => {
      document.getElementById('opmlFileInput').click();
    });
    document.getElementById('opmlFileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) { handleOPMLFile(file); e.target.value = ''; }
    });
  };

  // ── Utilities ─────────────────────────────────────────────
  const generateFeedId = (feedUrl) => {
    let hash = 0;
    for (let i = 0; i < feedUrl.length; i++) {
      hash = (hash << 5) - hash + feedUrl.charCodeAt(i);
      hash |= 0;
    }
    return 'feed_' + Math.abs(hash);
  };

  const extractSiteUrl = (rawInput, feedUrl) => {
    try {
      const u = new URL(rawInput.startsWith('http') ? rawInput : 'https://' + rawInput);
      return u.origin;
    } catch {
      try { return new URL(feedUrl).origin; }
      catch { return feedUrl; }
    }
  };

  return { init };
})();

// Bootstrap
document.addEventListener('DOMContentLoaded', App.init);
