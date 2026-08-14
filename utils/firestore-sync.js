const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

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

  console.log('\n[Firestore Sync] Sincronizando elementos directamente a la base de datos de Firestore en vivo...');

  // 1. Sincronizar Noticias -> Colección 'posts'
  let noticiasCount = 0;
  for (const item of noticias) {
    try {
      const snap = await db.collection('posts')
        .where('enlaceOriginal', '==', item.url)
        .get();

      const itemImageUrl = item.imagenUrl || "/assets/blog/Sostenibilidad-en-envases-plasticos.jpg";

      if (snap.empty) {
        await db.collection('posts').add({
          titulo: item.titulo,
          extracto: item.resumen,
          contenido: `${item.resumen}\n\nFuente original: ${item.fuente}`,
          fuente: item.fuente,
          enlaceOriginal: item.url,
          imagenUrl: itemImageUrl,
          imageContain: false,
          activo: true, // Visible en el blog público
          createdAt: FieldValue.serverTimestamp()
        });
        noticiasCount++;
      } else {
        // Update existing document if imagenUrl was empty
        for (const doc of snap.docs) {
          if (!doc.data().imagenUrl) {
            await doc.ref.update({ imagenUrl: itemImageUrl });
          }
        }
      }
    } catch (e) {
      console.error(` Error al guardar noticia "${item.titulo}":`, e.message);
    }
  }

  // 2. Sincronizar Alertas Sanitarias -> Colección 'avisos'
  let alertasCount = 0;
  if (alertas.length > 0) {
    const titulosAlertas = alertas.map(a => a.titulo.replace(/alerta sanitaria:\s*/gi, '')).join(', ');
    const mensajeConsolidado = `Avisos recientes de COFEPRIS sobre ${titulosAlertas}. Se recomienda verificar lotes.`;

    const snap = await db.collection('avisos')
      .where('tipo', '==', 'alerta')
      .get();

    for (const doc of snap.docs) {
      if (doc.data().titulo.includes('06082026') || doc.data().titulo.includes('22072026') || doc.data().autoGenerado) {
        await doc.ref.delete();
      }
    }

    await db.collection('avisos').add({
      activo: true,
      autoGenerado: true,
      createdAt: FieldValue.serverTimestamp(),
      enlace: 'https://www.gob.mx/cofepris/documentos/alertas-sanitarias-de-medicamentos',
      imageContain: true,
      imagenUrl: "/assets/blog/COFEPRIS_logo.jpg",
      mensaje: mensajeConsolidado,
      tipo: "alerta",
      titulo: "Alertas Sanitarias COFEPRIS"
    });
    alertasCount = 1;
  }

  console.log(`[Firestore Sync] Éxito: ${noticiasCount} noticia(s) sincronizada(s) con imagen en "posts" y ${alertasCount} aviso en "avisos".`);
}

module.exports = {
  syncToFirestore
};
