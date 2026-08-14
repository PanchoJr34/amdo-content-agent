const MONTHS_ES = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
  noviembre: 10, diciembre: 11
};

/**
 * Parses raw date string into standard Date object
 */
function parseSpanishDate(rawDate) {
  if (!rawDate) return null;
  const cleaned = rawDate.trim().toLowerCase();

  // 1. Format: YYYY-MM-DD
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const d = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  // 2. Format: DD/MM/YYYY
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const d = new Date(parseInt(slashMatch[3]), parseInt(slashMatch[2]) - 1, parseInt(slashMatch[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // 3. Format: "13 de agosto de 2026" or "13 de agosto del 2026"
  const textMatch = cleaned.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de(?:l)?\s+(\d{4})/);
  if (textMatch) {
    const day = parseInt(textMatch[1]);
    const month = MONTHS_ES[textMatch[2]];
    const year = parseInt(textMatch[3]);
    if (month !== undefined) {
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // 4. Format: DDMMYYYY (e.g. 06082026 in COFEPRIS attachment URLs)
  const compactMatch = cleaned.match(/(\d{2})(\d{2})(\d{4})/);
  if (compactMatch && compactMatch[0].length === 8) {
    const day = parseInt(compactMatch[1]);
    const month = parseInt(compactMatch[2]) - 1;
    const year = parseInt(compactMatch[3]);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // 5. Fallback Date constructor
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
function formatDateISO(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return null;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a date falls within the last 30 days
 */
function isWithinLast30Days(dateObj, refDate = new Date()) {
  if (!dateObj) return false;

  // Set reference date time to end of day for fair comparison
  const endRef = new Date(refDate);
  endRef.setHours(23, 59, 59, 999);

  const startCutoff = new Date(refDate);
  startCutoff.setDate(startCutoff.getDate() - 30);
  startCutoff.setHours(0, 0, 0, 0);

  return dateObj >= startCutoff && dateObj <= endRef;
}

module.exports = {
  parseSpanishDate,
  formatDateISO,
  isWithinLast30Days
};
