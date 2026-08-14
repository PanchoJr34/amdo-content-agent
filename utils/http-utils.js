const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
};

/**
 * Fetches HTML from a given URL with proper character encoding handling
 */
async function fetchHtml(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[HTTP ${response.status}] No se pudo obtener la URL: ${url}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();

    let encoding = 'utf-8';
    if (contentType.toLowerCase().includes('iso-8859-1') || contentType.toLowerCase().includes('latin1')) {
      encoding = 'iso-8859-1';
    } else {
      // Inspect initial bytes for meta charset tag
      const preview = new TextDecoder('utf-8').decode(arrayBuffer.slice(0, 1000));
      if (preview.toLowerCase().includes('charset=iso-8859-1') || preview.toLowerCase().includes('charset="iso-8859-1"')) {
        encoding = 'iso-8859-1';
      }
    }

    return new TextDecoder(encoding).decode(arrayBuffer);
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

module.exports = {
  fetchHtml,
  verifyUrl
};
