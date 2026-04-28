/**
 * FeedFlow — Storage Module
 * Manages persistence via localStorage
 */

const Storage = (() => {
  const KEYS = {
    FEEDS:    'feedflow_feeds',
    ARTICLES: 'feedflow_articles',
    READ:     'feedflow_read',
    STARRED:  'feedflow_starred',
    SETTINGS: 'feedflow_settings',
  };

  const get = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const set = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('[Storage] write error:', e);
      return false;
    }
  };

  // ── Feeds ─────────────────────────────────────────────────
  const getFeeds = () => get(KEYS.FEEDS) || [];

  const saveFeed = (feed) => {
    const feeds = getFeeds();
    const idx = feeds.findIndex(f => f.id === feed.id);
    if (idx >= 0) feeds[idx] = feed;
    else feeds.push(feed);
    set(KEYS.FEEDS, feeds);
  };

  const deleteFeed = (id) => {
    const feeds = getFeeds().filter(f => f.id !== id);
    set(KEYS.FEEDS, feeds);
  };

  const feedExists = (feedUrl) => {
    return getFeeds().some(f => f.feedUrl === feedUrl);
  };

  // ── Articles ──────────────────────────────────────────────
  const getArticles = () => get(KEYS.ARTICLES) || [];

  const saveArticles = (articles) => {
    // Keep last 500 articles to avoid localStorage overflow
    const existing = getArticles();
    const existingIds = new Set(existing.map(a => a.id));
    const newOnes = articles.filter(a => !existingIds.has(a.id));
    const merged = [...newOnes, ...existing]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 500);
    set(KEYS.ARTICLES, merged);
    return newOnes.length;
  };

  const getArticlesByFeed = (feedId) => {
    return getArticles().filter(a => a.feedId === feedId);
  };

  const deleteArticlesByFeed = (feedId) => {
    const articles = getArticles().filter(a => a.feedId !== feedId);
    set(KEYS.ARTICLES, articles);
  };

  // ── Read / Starred ─────────────────────────────────────────
  const getReadIds   = () => new Set(get(KEYS.READ)    || []);
  const getStarredIds = () => new Set(get(KEYS.STARRED) || []);

  const markRead = (articleId) => {
    const ids = getReadIds();
    ids.add(articleId);
    set(KEYS.READ, [...ids]);
  };

  const markAllRead = (feedId = null) => {
    const articles = feedId ? getArticlesByFeed(feedId) : getArticles();
    const ids = getReadIds();
    articles.forEach(a => ids.add(a.id));
    set(KEYS.READ, [...ids]);
  };

  const toggleStarred = (articleId) => {
    const ids = getStarredIds();
    if (ids.has(articleId)) ids.delete(articleId);
    else ids.add(articleId);
    set(KEYS.STARRED, [...ids]);
    return ids.has(articleId);
  };

  // ── Settings ───────────────────────────────────────────────
  const getSettings = () => ({
    theme: 'dark',
    filter: 'all',
    ...(get(KEYS.SETTINGS) || {}),
  });

  const saveSettings = (patch) => {
    const current = getSettings();
    set(KEYS.SETTINGS, { ...current, ...patch });
  };

  return {
    getFeeds, saveFeed, deleteFeed, feedExists,
    getArticles, saveArticles, getArticlesByFeed, deleteArticlesByFeed,
    getReadIds, getStarredIds, markRead, markAllRead, toggleStarred,
    getSettings, saveSettings,
  };
})();
