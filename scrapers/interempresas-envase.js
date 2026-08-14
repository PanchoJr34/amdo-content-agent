const cheerio = require('cheerio');
const { fetchHtml, verifyUrl } = require('../utils/http-utils');
const { parseSpanishDate, formatDateISO, isWithinLast30Days } = require('../utils/date-utils');
const { generateExtracto, generateContenido } = require('../utils/summarizer');

async function scrapeInterempresasEnvase(refDate = new Date()) {
  console.log('[Scraper] Buscando noticias en Interempresas Envase...');
  const mainUrl = 'https://www.interempresas.net/Envase/';

  const html = await fetchHtml(mainUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  const candidateUrls = new Map();

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const title = $(el).text().trim();
    if (href && href.includes('/Envase/') && href.endsWith('.html') && !href.includes('NewslettersAlertas')) {
      const fullUrl = href.startsWith('http') ? href : `https://www.interempresas.net${href}`;
      if (title.length > 10) {
        candidateUrls.set(fullUrl, title);
      }
    }
  });

  const candidatesList = Array.from(candidateUrls.entries());

  const fetchPromises = candidatesList.slice(0, 15).map(async ([url, initialTitle]) => {
    const articleHtml = await fetchHtml(url);
    if (!articleHtml) return null;

    const $art = cheerio.load(articleHtml);

    let title = $art('h1').first().text().trim();
    if (!title || title.toLowerCase().includes('envase y embalaje')) {
      title = initialTitle;
    }
    if (!title || title.length < 5) return null;

    const dateText = articleHtml.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[0] ||
      $art('.fecha').text().trim() ||
      articleHtml.match(/(\d{4}-\d{2}-\d{2})/)?.[0];

    const parsedDate = parseSpanishDate(dateText);
    if (!parsedDate || !isWithinLast30Days(parsedDate, refDate)) return null;

    // Extract exact original article image from meta og:image or picture tag
    let originalImage = $art('meta[property="og:image"]').attr('content') ||
      $art('meta[name="twitter:image"]').attr('content') ||
      $art('.foto img, picture img').first().attr('src');

    if (originalImage) {
      if (originalImage.startsWith('//')) {
        originalImage = `https:${originalImage}`;
      } else if (originalImage.startsWith('/')) {
        originalImage = `https://www.interempresas.net${originalImage}`;
      }
    } else {
      originalImage = '/assets/blog/Sostenibilidad-en-envases-plasticos.jpg';
    }

    const bodyText = $art('.texto, .cuerpo, article').text() || $art('p').text();
    const extracto = generateExtracto(title, bodyText);
    const contenido = generateContenido(title, bodyText);

    return {
      titulo: title,
      fecha: formatDateISO(parsedDate),
      resumen: extracto,
      contenido,
      url,
      imagenUrl: originalImage,
      fuente: 'Interempresas Envase'
    };
  });

  const fetched = await Promise.all(fetchPromises);
  const validResults = fetched.filter(Boolean);

  console.log(`[Scraper] Interempresas Envase noticias encontradas (últimos 30 días): ${validResults.length}`);
  return validResults;
}

module.exports = scrapeInterempresasEnvase;
