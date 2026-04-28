/**
 * FeedFlow — OPML Module
 * Import and export subscriptions in OPML 2.0 format.
 */

const OPML = (() => {

  /**
   * Export feeds array to OPML XML string
   */
  const exportFeeds = (feeds) => {
    const date = new Date().toUTCString();
    const outlines = feeds.map(f => {
      const title   = escXml(f.title || f.siteUrl);
      const xmlUrl  = escXml(f.feedUrl);
      const htmlUrl = escXml(f.siteUrl);
      return `    <outline type="rss" text="${title}" title="${title}" xmlUrl="${xmlUrl}" htmlUrl="${htmlUrl}"/>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>FeedFlow Subscriptions</title>
    <dateCreated>${date}</dateCreated>
    <dateModified>${date}</dateModified>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
  };

  /**
   * Parse OPML string, returns array of { title, feedUrl, siteUrl }
   */
  const importOpml = (xmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('OPML inválido.');

    const outlines = Array.from(doc.querySelectorAll('outline[xmlUrl], outline[xmlurl]'));
    if (outlines.length === 0) throw new Error('Nenhum feed encontrado no arquivo OPML.');

    return outlines.map(el => ({
      title:   el.getAttribute('title') || el.getAttribute('text') || '',
      feedUrl: el.getAttribute('xmlUrl') || el.getAttribute('xmlurl') || '',
      siteUrl: el.getAttribute('htmlUrl') || el.getAttribute('htmlurl') || '',
    })).filter(f => f.feedUrl);
  };

  /**
   * Trigger browser download of a text file
   */
  const downloadFile = (content, filename, mimeType = 'text/xml') => {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const escXml = (str = '') =>
    str.replace(/&/g, '&amp;')
       .replace(/"/g, '&quot;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;');

  return { exportFeeds, importOpml, downloadFile };
})();
