const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
};

const GOB_MX_HOST = 'www.gob.mx';
const GOB_MX_TRANSLATE_HOST = 'www-gob-mx.translate.goog';

function isGobMxUrl(url) {
  try {
    return new URL(url).hostname === GOB_MX_HOST;
  } catch (_) {
    return false;
  }
}

function isChallengePage(content) {
  return /<title>\s*challenge validation\s*<\/title>|id=["']sec-(?:text|if)-container["']/i.test(content);
}

// gob.mx responds with HTTP 200 even when its anti-bot service has returned a
// challenge. Google Translate fetches the same public page server-side, so it
// is a narrowly-scoped fallback for that specific response (not a replacement
// for the official source).
function buildGobMxTranslateUrl(url) {
  const original = new URL(url);
  const params = new URLSearchParams(original.search);
  params.set('_x_tr_sl', 'auto');
  params.set('_x_tr_tl', 'es');
  params.set('_x_tr_hl', 'es');
  return `https://${GOB_MX_TRANSLATE_HOST}${original.pathname}?${params.toString()}`;
}

function normalizeGobMxUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== GOB_MX_TRANSLATE_HOST) return url;

    ['_x_tr_sl', '_x_tr_tl', '_x_tr_hl', '_x_tr_pto'].forEach((key) => parsed.searchParams.delete(key));
    const query = parsed.searchParams.toString();
    return `https://${GOB_MX_HOST}${parsed.pathname}${query ? `?${query}` : ''}`;
  } catch (_) {
    return url;
  }
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout || 15000);
  try {
    return await fetch(url, {
      ...options,
      headers: DEFAULT_HEADERS,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function decodeHtml(arrayBuffer, contentType = '') {
  let encoding = 'utf-8';
  if (contentType.toLowerCase().includes('iso-8859-1') || contentType.toLowerCase().includes('latin1')) {
    encoding = 'iso-8859-1';
  } else {
    const preview = new TextDecoder('utf-8').decode(arrayBuffer.slice(0, 1000));
    if (preview.toLowerCase().includes('charset=iso-8859-1') || preview.toLowerCase().includes('charset="iso-8859-1"')) {
      encoding = 'iso-8859-1';
    }
  }
  return new TextDecoder(encoding).decode(arrayBuffer);
}

/**
 * Fetches HTML from a given URL with proper character encoding handling
 */
async function fetchHtml(url) {
  try {
    let response = await request(url);

    if (!response.ok) {
      console.warn(`[HTTP ${response.status}] No se pudo obtener la URL: ${url}`);
      return null;
    }

    let html = decodeHtml(await response.arrayBuffer(), response.headers.get('content-type') || '');
    if (isGobMxUrl(url) && isChallengePage(html)) {
      console.warn(`[HTTP] gob.mx presentó un desafío anti-bot; reintentando la copia pública para: ${url}`);
      response = await request(buildGobMxTranslateUrl(url));
      if (!response.ok) {
        console.warn(`[HTTP ${response.status}] No se pudo obtener la copia pública de: ${url}`);
        return null;
      }
      html = decodeHtml(await response.arrayBuffer(), response.headers.get('content-type') || '');
    }
    return html;
  } catch (error) {
    console.error(`[Error HTTP] Fallo al consultar ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Verifies if a URL returns HTTP status 200
 */
async function verifyUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    let response = await request(url, { method: 'GET', timeout: 10000 });
    if (response.status !== 200) return false;

    const contentType = response.headers.get('content-type') || '';
    if (!isGobMxUrl(url) || !contentType.includes('text/html')) return true;

    const body = await response.text();
    if (!isChallengePage(body)) return true;

    response = await request(buildGobMxTranslateUrl(url), { method: 'GET', timeout: 10000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

module.exports = {
  fetchHtml,
  verifyUrl,
  normalizeGobMxUrl
};
