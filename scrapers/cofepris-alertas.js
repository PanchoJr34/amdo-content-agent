const cheerio = require('cheerio');
const { fetchHtml, verifyUrl } = require('../utils/http-utils');
const { parseSpanishDate, formatDateISO, isWithinLast30Days } = require('../utils/date-utils');
const { generateAlertSummary } = require('../utils/summarizer');

function cleanAlertTitle(rawTitle, filename) {
  let title = rawTitle || filename || '';
  title = title
    .replace(/^\d+[_ ]*/, '') // remove prefix numbers like 318_
    .replace(/\.pdf$/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If title has repetitive Alerta Sanitaria
  title = title.replace(/^alerta\s+sanitaria\s*/gi, '').trim();
  return `Alerta Sanitaria: ${title.charAt(0).toUpperCase() + title.slice(1)}`;
}

async function scrapeCofeprisAlertas(refDate = new Date()) {
  console.log('[Scraper] Buscando Alertas Sanitarias en COFEPRIS...');
  const results = [];
  const mainUrl = 'https://www.gob.mx/cofepris/documentos/alertas-sanitarias-de-medicamentos';

  const html = await fetchHtml(mainUrl);
  if (!html) return results;

  const $ = cheerio.load(html);
  const processedUrls = new Set();

  $('tr, li, p, div.documento-item').each((_, element) => {
    const text = $(element).text().trim().replace(/\s+/g, ' ');
    const linkEl = $(element).find('a').first();
    const href = linkEl.attr('href');

    if (!href) return;
    const fullUrl = href.startsWith('http') ? href : `https://www.gob.mx${href}`;
    if (processedUrls.has(fullUrl)) return;

    let rawDateStr = text.match(/(\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{4})/i)?.[0] ||
      text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/)?.[0] ||
      href.match(/(\d{8})(?:\.pdf|$)/)?.[1];

    const parsedDate = parseSpanishDate(rawDateStr);
    if (!parsedDate || !isWithinLast30Days(parsedDate, refDate)) return;

    let rawTitle = linkEl.attr('title') || linkEl.text().trim();
    if (!rawTitle || rawTitle.toLowerCase().includes('descargar')) {
      const cleanText = text.replace(/descargar documento|pdf|documento/gi, '').trim();
      rawTitle = cleanText.length > 5 ? cleanText : href.split('/').pop();
    }

    const title = cleanAlertTitle(rawTitle, href.split('/').pop());
    processedUrls.add(fullUrl);

    const resumen = generateAlertSummary(title);

    results.push({
      titulo: title,
      fecha: formatDateISO(parsedDate),
      resumen,
      url: fullUrl,
      fuente: 'COFEPRIS',
      _parsedDate: parsedDate
    });
  });

  const validResults = [];
  for (const item of results) {
    const isValid = await verifyUrl(item.url);
    if (isValid) {
      delete item._parsedDate;
      validResults.push(item);
    }
  }

  console.log(`[Scraper] COFEPRIS Alertas encontradas (últimos 30 días): ${validResults.length}`);
  return validResults;
}

module.exports = scrapeCofeprisAlertas;
