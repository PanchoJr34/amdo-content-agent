const cheerio = require('cheerio');
const { fetchHtml, verifyUrl } = require('../utils/http-utils');
const { parseSpanishDate, formatDateISO, isWithinLast30Days } = require('../utils/date-utils');
const { generateSummary } = require('../utils/summarizer');

async function scrapeAmbientePlastico(refDate = new Date()) {
  console.log('[Scraper] Buscando noticias en Ambiente Plástico...');
  const results = [];
  const mainUrl = 'https://ambienteplastico.com/';

  const html = await fetchHtml(mainUrl);
  if (!html) return results;

  const $ = cheerio.load(html);
  const candidateUrls = new Map();

  $('h2 a, h3 a, h4 a, .entry-title a').each((_, element) => {
    const href = $(element).attr('href');
    const title = $(element).text().trim();

    if (
      href &&
      href.startsWith('https://ambienteplastico.com/') &&
      !href.includes('/category/') &&
      !href.includes('/tag/') &&
      !href.includes('/ebooks/') &&
      !href.includes('/contacto') &&
      title.length > 15
    ) {
      candidateUrls.set(href, title);
    }
  });

  const candidatesList = Array.from(candidateUrls.entries());

  const fetchPromises = candidatesList.slice(0, 15).map(async ([url, initialTitle]) => {
    const articleHtml = await fetchHtml(url);
    if (!articleHtml) return null;

    const $art = cheerio.load(articleHtml);
    const title = $art('h1.entry-title, h1').first().text().trim() || initialTitle;

    const dateText = $art('time').attr('datetime') ||
      $art('time').first().text().trim() ||
      articleHtml.match(/datetime="([^"]+)"/)?.[1] ||
      articleHtml.match(/(\d{4}-\d{2}-\d{2})/)?.[0] ||
      articleHtml.match(/(\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4})/i)?.[0];

    const parsedDate = parseSpanishDate(dateText);
    if (!parsedDate || !isWithinLast30Days(parsedDate, refDate)) return null;

    const isValid = await verifyUrl(url);
    if (!isValid) return null;

    // Image extraction
    let imageUrl = $art('meta[property="og:image"]').attr('content') ||
      $art('meta[name="twitter:image"]').attr('content') ||
      $art('.entry-content img, article img').first().attr('src') ||
      '/assets/blog/sostenibilidad_plastico.jpg';

    if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
      imageUrl = `https://ambienteplastico.com/${imageUrl}`;
    }

    const bodyText = $art('.entry-content, article').text() || $art('p').text();
    const resumen = generateSummary(title, bodyText);

    return {
      titulo: title,
      fecha: formatDateISO(parsedDate),
      resumen,
      url,
      imagenUrl: imageUrl,
      fuente: 'Ambiente Plástico'
    };
  });

  const fetched = await Promise.all(fetchPromises);
  const validResults = fetched.filter(Boolean);

  console.log(`[Scraper] Ambiente Plástico noticias encontradas (últimos 30 días): ${validResults.length}`);
  return validResults;
}

module.exports = scrapeAmbientePlastico;
