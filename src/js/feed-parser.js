/**
 * FeedFlow — Feed Parser
 * Parses RSS 1.0, RSS 2.0 and Atom feeds into normalised Article objects.
 */

const FeedParser = (() => {

  const slugify = (str) =>
    str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const generateId = (feedId, link, title) => {
    const base = link || title || Math.random().toString();
    let hash = 0;
    for (let i = 0; i < base.length; i++) {
      hash = (hash << 5) - hash + base.charCodeAt(i);
      hash |= 0;
    }
    return `${feedId}_${Math.abs(hash)}`;
  };

  const getText = (el, tag) => {
    if (!el) return '';
    const node = el.querySelector(tag);
    return node ? (node.textContent || '').trim() : '';
  };

  const getAttr = (el, tag, attr) => {
    if (!el) return '';
    const node = el.querySelector(tag);
    return node ? (node.getAttribute(attr) || '').trim() : '';
  };

  const stripHtml = (html) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').trim();
  };

  const extractImage = (el) => {
    // Try enclosure (RSS 2.0 podcasts / images)
    const enclosure = el.querySelector('enclosure');
    if (enclosure) {
      const type = enclosure.getAttribute('type') || '';
      if (type.startsWith('image/')) return enclosure.getAttribute('url') || '';
    }
    // Try media:thumbnail or media:content
    const mediaThumbs = [
      el.querySelector('thumbnail'),
      el.querySelector('content[medium="image"]'),
      el.querySelector('content[type^="image"]'),
    ];
    for (const m of mediaThumbs) {
      if (m) {
        const url = m.getAttribute('url') || m.getAttribute('src') || '';
        if (url) return url;
      }
    }
    // Try og:image in description HTML
    const desc = getText(el, 'description') || getText(el, 'content') || '';
    const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) return imgMatch[1];
    return '';
  };

  /**
   * Parse RSS 2.0 / RSS 1.0
   */
  const parseRSS = (doc, feedId) => {
    const channel = doc.querySelector('channel');
    const feedTitle = getText(channel, 'title');
    const feedLink  = getText(channel, 'link');
    const items = Array.from(doc.querySelectorAll('item'));

    const articles = items.map(item => {
      const title = getText(item, 'title');
      const link  = getText(item, 'link') || getAttr(item, 'link', 'href');
      const desc  = getText(item, 'description') || getText(item, 'summary') || getText(item, 'content\\:encoded');
      const dateStr = getText(item, 'pubDate') || getText(item, 'dc\\:date') || getText(item, 'date');
      const image = extractImage(item);
      const cats  = Array.from(item.querySelectorAll('category')).map(c => c.textContent.trim());

      return {
        id: generateId(feedId, link, title),
        feedId,
        title: stripHtml(title),
        link,
        summary: stripHtml(desc).slice(0, 300),
        content: desc,
        date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
        image,
        categories: cats.slice(0, 3),
      };
    });

    return { feedTitle, feedLink, articles };
  };

  /**
   * Parse Atom 1.0
   */
  const parseAtom = (doc, feedId) => {
    const feedEl   = doc.querySelector('feed');
    const feedTitle = getText(feedEl, 'title');
    const feedLink  = getAttr(feedEl, 'link[rel="alternate"]', 'href') ||
                      getAttr(feedEl, 'link', 'href');
    const entries  = Array.from(doc.querySelectorAll('entry'));

    const articles = entries.map(entry => {
      const title   = getText(entry, 'title');
      const link    = getAttr(entry, 'link[rel="alternate"]', 'href') ||
                      getAttr(entry, 'link', 'href');
      const summary = getText(entry, 'summary');
      const content = getText(entry, 'content');
      const dateStr = getText(entry, 'published') || getText(entry, 'updated');
      const image   = extractImage(entry);
      const cats    = Array.from(entry.querySelectorAll('category')).map(c => c.getAttribute('term') || '');

      return {
        id: generateId(feedId, link, title),
        feedId,
        title: stripHtml(title),
        link,
        summary: stripHtml(summary || content).slice(0, 300),
        content: content || summary,
        date: dateStr ? new Date(dateStr).toISOString() : new Date().toISOString(),
        image,
        categories: cats.filter(Boolean).slice(0, 3),
      };
    });

    return { feedTitle, feedLink, articles };
  };

  /**
   * Main parse function.
   * Accepts XML string, returns { feedTitle, feedLink, articles }
   */
  const parse = (xmlString, feedId) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) throw new Error('XML inválido: ' + parseError.textContent.slice(0, 80));

    const isAtom = doc.querySelector('feed') !== null;
    const isRSS  = doc.querySelector('rss, channel, rdf\\:RDF') !== null;

    if (isAtom) return parseAtom(doc, feedId);
    if (isRSS)  return parseRSS(doc, feedId);

    throw new Error('Formato de feed não reconhecido (esperado RSS ou Atom).');
  };

  return { parse };
})();
