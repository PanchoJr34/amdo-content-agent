const cheerio = require('cheerio');
const { fetchHtml, verifyUrl } = require('../utils/http-utils');
const { parseSpanishDate, formatDateISO, isWithinLast30Days } = require('../utils/date-utils');
const { generateSummary } = require('../utils/summarizer');

async function scrapePtMexico(refDate = new Date()) {
  console.log('[Scraper] Buscando noticias en PT México...');
  const results = [];
  const mainUrl = 'https://www.pt-mexico.com/';

  const html = await fetchHtml(mainUrl);
  if (!html) return results;

  const $ = cheerio.load(html);
  const candidateUrls = new Map();

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const title = $(el).text().trim();
    if (href && (href.startsWith('/noticias/post/') || href.startsWith('/productos/')) && title.length > 15) {
      const fullUrl = `https://www.pt-mexico.com${href}`;
      candidateUrls.set(fullUrl, title);
    }
  });

  const candidatesList = Array.from(candidateUrls.entries());

  const fetchPromises = candidatesList.slice(0, 15).map(async ([url, initialTitle]) => {
    const articleHtml = await fetchHtml(url);
    if (!articleHtml) return null;

    const $art = cheerio.load(articleHtml);
    const title = $art('h1').first().text().trim() || initialTitle;
    if (!title || title.length < 5) return null;

    const dateText = $art('.date, .post-date, time, .date-published').text().trim() ||
      articleHtml.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[0] ||
      articleHtml.match(/(\d{4}-\d{2}-\d{2})/)?.[0] ||
      articleHtml.match(/(\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4})/i)?.[0];

    const parsedDate = parseSpanishDate(dateText);
    if (!parsedDate || !isWithinLast30Days(parsedDate, refDate)) return null;

    const isValid = await verifyUrl(url);
    if (!isValid) return null;

    const bodyText = $art('article, .content, .post-body').text() || $art('p').text();
    const resumen = generateSummary(title, bodyText);

    return {
      titulo: title,
      fecha: formatDateISO(parsedDate),
      resumen,
      url,
      fuente: 'PT México'
    };
  });

  const fetched = await Promise.all(fetchPromises);
  const validResults = fetched.filter(Boolean);

  console.log(`[Scraper] PT México noticias encontradas (últimos 30 días): ${validResults.length}`);
  return validResults;
}

module.exports = scrapePtMexico;
