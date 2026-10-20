const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { generateExtracto, generateContenido } = require('./summarizer');
const { getPharmaImageForArticle } = require('./image-assigner');

// Días que una alerta sanitaria se considera vigente desde su fecha de emisión.
// Debe coincidir con ALERTA_VIGENCIA_DIAS del sitio web (src/utils/alertas.js).
const ALERTA_VIGENCIA_DIAS = 30;
const DIA_MS = 24 * 60 * 60 * 1000;

function fechaDeAviso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Fecha límite de vigencia (ISO) calculada a partir de la fecha de emisión.
function vigenteHastaDe(fechaEmision) {
  const base = fechaDeAviso(fechaEmision) || new Date();
  return new Date(base.getTime() + ALERTA_VIGENCIA_DIAS * DIA_MS).toISOString();
}

// Desactiva en Firestore las alertas sanitarias vencidas, para que el sitio deje de mostrarlas.
async function desactivarAlertasVencidas(db) {
  const ahora = Date.now();
  const snap = await db.collection('avisos')
    .where('tipo', '==', 'alerta-sanitaria')
    .where('activo', '==', true)
    .get();

  let desactivadas = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const limite = fechaDeAviso(data.vigenteHasta);
    const emision = fechaDeAviso(data.fecha) || fechaDeAviso(data.createdAt);
    const vencida = limite
      ? ahora > limite.getTime()
      : emision && ahora - emision.getTime() > ALERTA_VIGENCIA_DIAS * DIA_MS;

    if (vencida) {
      await doc.ref.update({
        activo: false,
        desactivadoAutomaticamente: true,
        desactivadoEn: FieldValue.serverTimestamp()
      });
      desactivadas++;
    }
  }
  return desactivadas;
}

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    return getFirestore();
  }

  const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
  if (!fs.existsSync(serviceAccountPath)) {
    console.log('[Firestore Sync] No se encontró service-account.json. Omitiendo sincronización directa a Firestore.');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount)
    });
    console.log('[Firestore Sync] Firebase Admin SDK inicializado correctamente con Cuenta de Servicio.');
    return getFirestore();
  } catch (err) {
    console.error('[Firestore Sync Error] Error al inicializar Firebase Admin:', err.message);
    return null;
  }
}

async function syncToFirestore(noticias, alertas) {
  const db = initFirebaseAdmin();
  if (!db) return;

  console.log('\n[Firestore Sync] Sincronizando elementos de Noticias y Alertas Sanitarias a Firestore...');

  // 1. Sincronizar Noticias -> Colección 'posts'
  let noticiasCount = 0;
  let noticiasNuevas = 0;
  for (let i = 0; i < noticias.length; i++) {
    const item = noticias[i];
    try {
      const snap = await db.collection('posts')
        .where('enlaceOriginal', '==', item.url)
        .get();

      // Prioriza la foto real extraída del artículo (og:image); solo usa la
      // genérica por palabra clave cuando el scraper no encontró ninguna.
      const topicImage = item.imagenUrl || getPharmaImageForArticle(item.titulo, item.contenido, i);
      const extractoExtendido = item.resumen || generateExtracto(item.titulo, '');
      const contenidoDetallado = item.contenido || generateContenido(item.titulo, '');

      if (snap.empty) {
        await db.collection('posts').add({
          titulo: item.titulo,
          extracto: extractoExtendido,
          contenido: contenidoDetallado,
          fuente: item.fuente,
          enlaceOriginal: item.url,
          imagenUrl: topicImage,
          imageContain: false,
          activo: true,
          createdAt: FieldValue.serverTimestamp()
        });
        noticiasCount++;
        noticiasNuevas++;
      } else {
        const docId = snap.docs[0].id;
        await db.collection('posts').doc(docId).update({
          titulo: item.titulo,
          extracto: extractoExtendido,
          contenido: contenidoDetallado,
          fuente: item.fuente,
          imagenUrl: topicImage
        });
        noticiasCount++;
      }
    } catch (err) {
      console.error(`[Firestore Sync Error] Error al guardar noticia "${item.titulo}":`, err.message);
    }
  }
  console.log(`[Firestore Sync] Éxito: Sincronizados ${noticiasCount} artículos en "posts" (${noticiasNuevas} nuevos, ${noticiasCount - noticiasNuevas} ya existían).`);

  // 2. Sincronizar CADA Alerta Sanitaria COFEPRIS individualmente -> Colección 'avisos'
  let alertasCount = 0;
  let alertasNuevas = 0;
  if (alertas && alertas.length > 0) {
    for (let i = 0; i < alertas.length; i++) {
      const alerta = alertas[i];
      try {
        const snap = await db.collection('avisos')
          .where('url', '==', alerta.url)
          .get();

        if (snap.empty) {
          await db.collection('avisos').add({
            titulo: alerta.titulo,
            mensaje: alerta.resumen || alerta.titulo,
            resumen: alerta.resumen || alerta.titulo,
            fecha: alerta.fecha || new Date().toISOString(),
            vigenteHasta: vigenteHastaDe(alerta.fecha),
            url: alerta.url,
            fuente: 'COFEPRIS',
            tipo: 'alerta-sanitaria',
            activo: true,
            createdAt: FieldValue.serverTimestamp()
          });
          alertasCount++;
          alertasNuevas++;
        } else {
          const docId = snap.docs[0].id;
          await db.collection('avisos').doc(docId).update({
            titulo: alerta.titulo,
            mensaje: alerta.resumen || alerta.titulo,
            resumen: alerta.resumen || alerta.titulo,
            fecha: alerta.fecha || new Date().toISOString(),
            vigenteHasta: vigenteHastaDe(alerta.fecha),
            url: alerta.url
          });
          alertasCount++;
        }
      } catch (err) {
        console.error(`[Firestore Sync Error] Error al guardar alerta "${alerta.titulo}":`, err.message);
      }
    }
    console.log(`[Firestore Sync] Éxito: Sincronizadas ${alertasCount} Alertas Sanitarias individuales en "avisos" (${alertasNuevas} nuevas, ${alertasCount - alertasNuevas} ya existían).`);
  }

  // 3. Desactivar alertas sanitarias vencidas (más de ALERTA_VIGENCIA_DIAS desde su emisión)
  let alertasDesactivadas = 0;
  try {
    alertasDesactivadas = await desactivarAlertasVencidas(db);
    console.log(`[Firestore Sync] Alertas vencidas desactivadas automáticamente: ${alertasDesactivadas}.`);
  } catch (err) {
    console.error('[Firestore Sync Error] No se pudieron desactivar alertas vencidas:', err.message);
  }

  return { noticiasNuevas, alertasNuevas, alertasDesactivadas };
}

module.exports = {
  syncToFirestore
};
