/**
 * Professional Industry Content Synthesizer & Summarizer for AMDO
 * Creates detailed, rich multi-paragraph articles providing thorough context
 * on packaging, plastic manufacturing, and pharma regulations.
 */

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates an engaging 3-4 line summary for blog card previews.
 */
function generateExtracto(title, content = '') {
  const cleanedTitle = cleanText(title);
  const cleanedContent = cleanText(content);

  const sentences = cleanedContent
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25 && !s.includes('http') && !s.includes('Cookie'));

  const leadSentence = sentences[0] || cleanedTitle;
  const secondSentence = sentences[1] || '';
  const thirdSentence = sentences[2] || '';

  let extract = `${leadSentence} ${secondSentence} ${thirdSentence}`.trim();
  if (extract.length > 350) {
    extract = extract.substring(0, 347) + '...';
  } else if (extract.length < 80) {
    extract = `${cleanedTitle}. Esta actualización aborda las tendencias en innovación de envases, normativas de calidad y competitividad en la industria farmacéutica y del plástico en México y Latinoamérica.`;
  }

  return extract;
}

/**
 * Generates a full multi-paragraph detailed article content.
 */
function generateContenido(title, content = '') {
  const cleanedTitle = cleanText(title);
  const cleanedContent = cleanText(content);

  const rawParagraphs = content
    .split(/\n\s*\n|\r\n\r\n/)
    .map(cleanText)
    .filter(p => p.length > 60 && !p.toLowerCase().includes('cookie') && !p.toLowerCase().includes('derechos reservados') && !p.includes('http'));

  if (rawParagraphs.length >= 3) {
    return rawParagraphs.slice(0, 5).join('\n\n');
  }

  // Synthesize a structured, multi-paragraph professional article if raw content is short
  const paragraph1 = `### Panorama e Innovación\n${cleanedTitle} representa una actualización de relevante interés para el sector de envases plásticos y la industria farmacéutica. ${cleanedContent.substring(0, 400)}`;

  const paragraph2 = `### Impacto Regulatorio y Operativo\nDentro de la cadena de suministro de empaque primario y secundario, el cumplimiento normativo y la optimización de procesos garantizan la hermeticidad, inocuidad y seguridad de los productos medicinales e industriales. Mantener estándares elevados en la selección de resinas y tecnologías de moldeo por soplado e inyección resulta fundamental para responder a las exigencias del mercado actual.`;

  const paragraph3 = `### Perspectivas para el Sector\nLa constante evolución en criterios de sostenibilidad, reciclabilidad y eficiencia energética impulsa a los fabricantes a adoptar mejores prácticas industriales. Esta noticia refuerza la importancia de la mejora continua y el monitoreo de tendencias globales de calidad y empaque.`;

  return `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;
}

module.exports = {
  cleanText,
  generateExtracto,
  generateContenido,
  generateSummary: generateExtracto
};
