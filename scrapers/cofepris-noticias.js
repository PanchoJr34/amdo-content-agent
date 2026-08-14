const cheerio = require('cheerio');
const { fetchHtml, verifyUrl } = require('../utils/http-utils');
const { parseSpanishDate, formatDateISO, isWithinLast30Days } = require('../utils/date-utils');
const { generateSummary } = require('../utils/summarizer');

async function scrapeCofeprisNoticias(refDate = new Date()) {
  console.log('[Scraper] Buscando noticias en COFEPRIS...');
  const results = [];
  const listingUrls = [
    'https://www.gob.mx/cofepris/archivo/prensa',
    'https://www.gob.mx/cofepris/archivo/articulos'
  ];

  const processedUrls = new Set();

  for (const listUrl of listingUrls) {
    const html = await fetchHtml(listUrl);
    if (!html) continue;

    const $ = cheerio.load(html);

    // Extract article links
    const articleLinks = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && (href.includes('/cofepris/prensa/') || href.includes('/cofepris/es/articulos/'))) {
        const fullUrl = href.startsWith('http') ? href : `https://www.gob.mx${href}`;
        if (!processedUrls.has(fullUrl)) {
          processedUrls.add(fullUrl);
          articleLinks.push(fullUrl);
        }
      }
    });

    // Process top recent candidate links
    for (const url of articleLinks.slice(0, 10)) {
      const articleHtml = await fetchHtml(url);
      if (!articleHtml) continue;

      const $art = cheerio.load(articleHtml);

      // Extract title
      let title = $art('h1').first().text().trim() || $art('h2').first().text().trim();
      if (!title) continue;

      // Extract date text
      let dateText = $art('time').first().text().trim() ||
        $art('.date').text().trim() ||
        articleHtml.match(/(\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4})/i)?.[0];

      const parsedDate = parseSpanishDate(dateText);
      if (!parsedDate || !isWithinLast30Days(parsedDate, refDate)) {
        continue;
      }

      const isValid = await verifyUrl(url);
      if (!isValid) continue;

      const bodyText = $art('article').text() || $art('.main-content').text() || $art('p').text();
      const resumen = generateSummary(title, bodyText);

      results.push({
        titulo: title,
        fecha: formatDateISO(parsedDate),
        resumen,
        url,
        fuente: 'COFEPRIS'
      });
    }
  }

  console.log(`[Scraper] COFEPRIS Noticias encontradas (últimos 30 días): ${results.length}`);
  return results;
}

module.exports = scrapeCofeprisNoticias;
