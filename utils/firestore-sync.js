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

  console.log('\n[Firestore Sync] Sincronizando elementos con imágenes ÚNICAS y notas extendidas a Firestore en vivo...');

  // 1. Sincronizar Noticias -> Colección 'posts'
  let noticiasCount = 0;
  for (let i = 0; i < noticias.length; i++) {
    const item = noticias[i];
    try {
      const snap = await db.collection('posts')
        .where('enlaceOriginal', '==', item.url)
        .get();

      // Assign a unique, high-resolution pharmaceutical image tailored to the topic
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
          activo: true, // Visible en el blog público
          createdAt: FieldValue.serverTimestamp()
        });
        noticiasCount++;
      } else {
        // Update existing document to assign unique high-res topic image & rich text
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
  console.log(`[Firestore Sync] Éxito: Sincronizados ${noticiasCount} artículos con imágenes ÚNICAS en "posts".`);

  // 2. Limpiar duplicados y mantener 1 sola alerta sanitaria consolidada de COFEPRIS
  try {
    const snapAvisos = await db.collection('avisos').get();

    // Eliminar alertas viejas o de prueba
    const deletePromises = snapAvisos.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePromises);

    // Crear la Alerta Sanitaria Consolidada oficial de COFEPRIS en 1 sola entrada marquee
    if (alertas && alertas.length > 0) {
      const titulosAlertas = alertas.slice(0, 5).map(a => `${a.titulo} (COFEPRIS)`).join('  ●  ');
      await db.collection('avisos').add({
        titulo: 'Alertas Sanitarias COFEPRIS',
        mensaje: titulosAlertas,
        fecha: new Date().toISOString(),
        activo: true,
        tipo: 'alerta-sanitaria',
        createdAt: FieldValue.serverTimestamp()
      });
      console.log('[Firestore Sync] Éxito: Creada 1 sola alerta marqueé consolidada en "avisos".');
    }
  } catch (err) {
    console.error('[Firestore Sync Error] Error al consolidar avisos:', err.message);
  }
}

module.exports = {
  syncToFirestore
};
