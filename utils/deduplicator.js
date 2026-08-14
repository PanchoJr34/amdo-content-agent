/**
 * Title & Content Deduplicator
 * Prevents adding duplicate articles across sources
 */

function normalizeForComparison(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function getWordTokens(str) {
  const norm = normalizeForComparison(str);
  return new Set(norm.split(/\s+/).filter(w => w.length > 3));
}

function calculateSimilarity(str1, str2) {
  const tokens1 = getWordTokens(str1);
  const tokens2 = getWordTokens(str2);

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++;
  }

  const union = new Set([...tokens1, ...tokens2]).size;
  return intersection / union;
}

function deduplicateList(items) {
  const uniqueItems = [];
  const seenUrls = new Set();

  for (const item of items) {
    if (!item.url || seenUrls.has(item.url)) {
      continue;
    }

    let isDuplicate = false;
    for (const existing of uniqueItems) {
      const sim = calculateSimilarity(item.titulo, existing.titulo);
      if (sim > 0.65) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      seenUrls.add(item.url);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

module.exports = {
  calculateSimilarity,
  deduplicateList
};
