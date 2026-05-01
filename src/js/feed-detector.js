/**
 * FeedFlow — Feed Detector (v2)
 * Discovers RSS/Atom feeds from any URL.
 *
 * Proxies are tried in order; each has its own response-unwrapping logic.
 */

const FeedDetector = (() => {

  // Each proxy knows how to: build the request URL and unwrap the response.
  const PROXIES = [
    {
      // allorigins: returns JSON { contents, status }
      name: 'allorigins',
      build: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      unwrap: async (res) => {
        const json = await res.json();
        return {
          text: json.contents || '',
          contentType: json.status?.content_type || '',
        };
      },
    },
    {
      // corsproxy.io: returns raw body, content-type in headers
      name: 'corsproxy.io',
      build: (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
      unwrap: async (res) => ({
        text: await res.text(),
        contentType: res.headers.get('content-type') || '',
      }),
    },
    {
      // thingproxy: returns raw body
      name: 'thingproxy',
      build: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
      unwrap: async (res) => ({
        text: await res.text(),
        contentType: res.headers.get('content-type') || '',
      }),
    },
  ];

  const COMMON_FEED_PATHS = [
    '/feed',
    '/feed.xml',
    '/feed.rss',
    '/feed.atom',
    '/rss',
    '/rss.xml',
    '/rss2.xml',
    '/atom.xml',
    '/atom',
    '/index.xml',
    '/feeds/posts/default',   // Blogger
    '/blog/feed',
    '/blog.rss',
    '/?feed=rss2',            // WordPress
    '/?feed=atom',
    '/wp-json/wp/v2/posts',   // WP REST (fallback)
  ];

  const FEED_CONTENT_TYPES = [
    'application/rss+xml',
    'application/atom+xml',
    'application/xml',
    'text/xml',
    'application/rdf+xml',
    'application/x-rss+xml',
  ];

  // ── Helpers ──────────────────────────────────────────────

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

  const looksLikeFeed = (text = '', contentType = '') => {
    if (FEED_CONTENT_TYPES.some(ct => contentType.toLowerCase().includes(ct))) return true;
    const t = text.trimStart().slice(0, 600);
    return (
      /<rss[\s>]/i.test(t) ||
      /<feed[\s>]/i.test(t) ||
      /<rdf:RDF/i.test(t) ||
      t.includes('xmlns="http://www.w3.org/2005/Atom"') ||
      t.includes('<channel>') ||
      t.includes('</rss>') ||
      t.includes('</feed>')
    );
  };

  const extractFeedLinksFromHtml = (html, baseOrigin) => {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const links = doc.querySelectorAll('link[rel="alternate"], link[rel="feed"]');
      const found = [];
      links.forEach(link => {
        const type = (link.getAttribute('type') || '').toLowerCase();
        const href = (link.getAttribute('href') || '').trim();
        if (!href) return;
        const isFeedType = FEED_CONTENT_TYPES.some(ct => type.includes(ct));
        const isFeedHref = /\.(rss|atom|xml)(\?.*)?$/i.test(href);
        if (isFeedType || isFeedHref) {
          let abs = href;
          if (!href.startsWith('http')) {
            abs = href.startsWith('/')
              ? baseOrigin + href
              : baseOrigin + '/' + href;
          }
          found.push({ url: abs, title: link.getAttribute('title') || '' });
        }
      });
      return found;
    } catch { return []; }
  };

  // ── Core fetch ───────────────────────────────────────────

  /**
   * Try fetching targetUrl through all proxies in sequence.
   * Returns { text, contentType } or throws if all fail.
   */
  const proxyFetch = async (targetUrl) => {
    const errors = [];
    for (const proxy of PROXIES) {
      try {
        const proxyUrl = proxy.build(targetUrl);
        const res = await fetch(proxyUrl, {
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const result = await proxy.unwrap(res);
        if (result.text) return result;   // success
        throw new Error('Resposta vazia');
      } catch (e) {
        errors.push(`[${proxy.name}] ${e.message}`);
      }
    }
    throw new Error('Todos os proxies falharam: ' + errors.join(' | '));
  };

  // ── Detection ────────────────────────────────────────────

  const detect = async (rawUrl, onProgress) => {
    const progress = onProgress || (() => {});
    const { origin, href } = normaliseUrl(rawUrl);

    progress('Verificando a URL...');

    // Step 1: Try the URL directly — maybe it IS a feed already
    try {
      const { text, contentType } = await proxyFetch(href);
      if (looksLikeFeed(text, contentType)) {
        return { feedUrl: href, title: '', method: 'direct' };
      }
      // It returned HTML — scan for <link rel="alternate">
      progress('Lendo a página em busca de feed...');
      const links = extractFeedLinksFromHtml(text, origin);
      if (links.length > 0) {
        return { feedUrl: links[0].url, title: links[0].title, method: 'link-tag' };
      }
    } catch (e) {
      console.warn('[FeedDetector] step 1 failed:', e.message);
    }

    // Step 2: Try common paths one by one
    progress('Testando caminhos comuns de feed...');
    for (const path of COMMON_FEED_PATHS) {
      const candidate = origin + path;
      try {
        const { text, contentType } = await proxyFetch(candidate);
        if (looksLikeFeed(text, contentType)) {
          return { feedUrl: candidate, title: '', method: 'common-path' };
        }
      } catch { /* try next */ }
    }

    return null;  // nothing found
  };

  const getFaviconUrl = (siteUrl) => {
    try {
      const { hostname } = new URL(siteUrl);
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
    } catch { return ''; }
  };

  return { detect, getFaviconUrl, proxyFetch, looksLikeFeed };
})();
