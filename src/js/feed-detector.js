/**
 * FeedFlow — Feed Detector
 * Discovers RSS/Atom feeds from a given URL.
 *
 * Strategy:
 *  1. Try common feed paths directly
 *  2. Fetch the page HTML and parse <link rel="alternate"> tags
 *  3. Return null if nothing found
 *
 * Uses CORS proxies as fallback since browsers block cross-origin requests.
 */

const FeedDetector = (() => {

  // Public CORS proxies (tried in order)
  const PROXIES = [
    (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];

  const COMMON_FEED_PATHS = [
    '/feed', '/feed.xml', '/feed.rss', '/feed.atom',
    '/rss', '/rss.xml', '/rss/feed', '/rss2.xml',
    '/atom.xml', '/atom', '/feeds/posts/default',
    '/index.xml', '/blog/feed', '/blog.rss',
    '/sitemap.xml', '/podcast.xml',
  ];

  // Feed content-type patterns
  const FEED_CONTENT_TYPES = [
    'application/rss+xml',
    'application/atom+xml',
    'application/xml',
    'text/xml',
    'application/rdf+xml',
  ];

  /**
   * Normalise input URL → clean origin + path
   */
  const normaliseUrl = (raw) => {
    let url = raw.trim();
    if (!url.match(/^https?:\/\//i)) url = 'https://' + url;
    try {
      const u = new URL(url);
      return { origin: u.origin, href: u.href };
    } catch {
      throw new Error(`URL inválida: ${raw}`);
    }
  };

  /**
   * Fetch via proxy. Returns { text, contentType } or throws.
   */
  const proxyFetch = async (targetUrl, proxyIndex = 0) => {
    if (proxyIndex >= PROXIES.length) throw new Error('Todos os proxies falharam.');
    const proxyUrl = PROXIES[proxyIndex](targetUrl);
    try {
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // allorigins wraps in { contents, status }
      if (json.contents !== undefined) {
        return {
          text: json.contents,
          contentType: json.status?.content_type || '',
        };
      }
      // corsproxy.io returns text directly
      return { text: json, contentType: '' };
    } catch (e) {
      if (proxyIndex + 1 < PROXIES.length) {
        return proxyFetch(targetUrl, proxyIndex + 1);
      }
      throw e;
    }
  };

  /**
   * Check if fetched content looks like a valid feed
   */
  const looksLikeFeed = (text, contentType = '') => {
    if (FEED_CONTENT_TYPES.some(ct => contentType.includes(ct))) return true;
    if (!text) return false;
    const t = text.trim().slice(0, 400);
    return (
      t.includes('<rss') ||
      t.includes('<feed') ||
      t.includes('<rdf:RDF') ||
      t.includes('xmlns="http://www.w3.org/2005/Atom"')
    );
  };

  /**
   * Parse <link rel="alternate"> from HTML
   */
  const extractFeedLinksFromHtml = (html, baseOrigin) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = doc.querySelectorAll('link[rel="alternate"]');
    const found = [];
    links.forEach(link => {
      const type = link.getAttribute('type') || '';
      const href = link.getAttribute('href') || '';
      if (
        FEED_CONTENT_TYPES.some(ct => type.includes(ct)) ||
        href.match(/\.(rss|atom|xml)(\?.*)?$/i)
      ) {
        const abs = href.startsWith('http') ? href : baseOrigin + (href.startsWith('/') ? '' : '/') + href;
        found.push({ url: abs, title: link.getAttribute('title') || '' });
      }
    });
    return found;
  };

  /**
   * Main detection function.
   * Returns { feedUrl, title, method } or null
   */
  const detect = async (rawUrl, onProgress) => {
    const progress = onProgress || (() => {});
    const { origin, href } = normaliseUrl(rawUrl);

    progress('Verificando URL informada...');

    // 1. Maybe the URL itself IS a feed
    try {
      const { text, contentType } = await proxyFetch(href);
      if (looksLikeFeed(text, contentType)) {
        return { feedUrl: href, title: '', method: 'direct' };
      }
      // It's HTML — try to extract <link rel="alternate">
      progress('Buscando feed na página...');
      const links = extractFeedLinksFromHtml(text, origin);
      if (links.length > 0) {
        return { feedUrl: links[0].url, title: links[0].title, method: 'link-tag' };
      }
    } catch { /* ignore, keep trying */ }

    // 2. Try common feed paths
    progress('Tentando caminhos comuns de feed...');
    for (const path of COMMON_FEED_PATHS) {
      const candidate = origin + path;
      try {
        const { text, contentType } = await proxyFetch(candidate);
        if (looksLikeFeed(text, contentType)) {
          return { feedUrl: candidate, title: '', method: 'common-path' };
        }
      } catch { /* continue */ }
    }

    // 3. Not found
    return null;
  };

  /**
   * Resolve a human-readable title from the feed's own metadata
   * (called after parsing the feed)
   */
  const getFaviconUrl = (siteUrl) => {
    try {
      const u = new URL(siteUrl);
      return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
    } catch { return ''; }
  };

  return { detect, getFaviconUrl, proxyFetch, looksLikeFeed };
})();
