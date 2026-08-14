/**
 * Pharmaceutical Packaging & Plastics Relevance Filter for Grupo AMDO
 * Ensures all harvested news articles strictly relate to:
 * - Pharmaceutical packaging (envases, frascos, tapas, blísteres)
 * - Plastics, polymers (PEAD, PET, polímeros farmacéuticos)
 * - COFEPRIS regulations, healthcare & pharmaceutical industry news.
 */

const PHARMA_PACKAGING_KEYWORDS = [
  'farmacéutic', 'farma', 'medicamento', 'salud', 'cofepris', 'fda',
  'envase', 'empaque', 'plástico', 'pead', 'pet', 'frasco', 'tapa',
  'blíster', 'dosificador', 'polímero', 'resina', 'ampolleta', 'laboratorio',
  'dispositivo médico', 'sanitar', 'inocuidad', 'soplado', 'inyección',
  'packaging', 'reciclaje plástico', 'circularidad'
];

const IRRELEVANT_EXCLUSIONS = [
  'panadería', 'pastelería', 'artesana', 'südback', 'panaderías', 'restauración',
  'comida rápida', 'carnes', 'pescado', 'frutas'
];

function isPharmaPackagingRelevant(title = '', content = '') {
  const text = `${title} ${content}`.toLowerCase();

  // 1. Exclude non-pharma food/bakery noise
  for (const exclusion of IRRELEVANT_EXCLUSIONS) {
    if (text.includes(exclusion) && !text.includes('farmacéutic') && !text.includes('medicamento')) {
      return false;
    }
  }

  // 2. Require at least 1-2 pharma/packaging/plastic keywords
  const matchCount = PHARMA_PACKAGING_KEYWORDS.filter(kw => text.includes(kw)).length;
  return matchCount >= 1;
}

module.exports = {
  isPharmaPackagingRelevant,
  PHARMA_PACKAGING_KEYWORDS
};
