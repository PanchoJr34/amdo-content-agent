const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { generateExtracto, generateContenido } = require('./summarizer');
const { getPharmaImageForArticle } = require('./image-assigner');

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
  for (let i = 0; i < noticias.length; i++) {
    const item = noticias[i];
    try {
      const snap = await db.collection('posts')
        .where('enlaceOriginal', '==', item.url)
        .get();

      const topicImage = getPharmaImageForArticle(item.titulo, item.contenido, i);
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
      } else {
        const docId = snap.docs[0].id;
        await db.collection('posts').doc(docId).update({
          titulo: item.titulo,
          extracto: extractoExtendido,
          contenido: contenidoDetallado,
          fuente: item.fuente,
          imagenUrl: topicImage,
          activo: true
        });
        noticiasCount++;
      }
    } catch (err) {
      console.error(`[Firestore Sync Error] Error al guardar noticia "${item.titulo}":`, err.message);
    }
  }
  console.log(`[Firestore Sync] Éxito: Sincronizados ${noticiasCount} artículos en "posts".`);

  // 2. Sincronizar CADA Alerta Sanitaria COFEPRIS individualmente -> Colección 'avisos'
  let alertasCount = 0;
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
            url: alerta.url,
            fuente: 'COFEPRIS',
            tipo: 'alerta-sanitaria',
            activo: true,
            createdAt: FieldValue.serverTimestamp()
          });
          alertasCount++;
        } else {
          const docId = snap.docs[0].id;
          await db.collection('avisos').doc(docId).update({
            titulo: alerta.titulo,
            mensaje: alerta.resumen || alerta.titulo,
            resumen: alerta.resumen || alerta.titulo,
            fecha: alerta.fecha || new Date().toISOString(),
            url: alerta.url,
            activo: true
          });
          alertasCount++;
        }
      } catch (err) {
        console.error(`[Firestore Sync Error] Error al guardar alerta "${alerta.titulo}":`, err.message);
      }
    }
    console.log(`[Firestore Sync] Éxito: Sincronizadas ${alertasCount} Alertas Sanitarias individuales en "avisos".`);
  }
}

module.exports = {
  syncToFirestore
};
