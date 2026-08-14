const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const GUARANTEED_IMAGES = [
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=800&auto=format&fit=crop'
];

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
  for (let i = 0; i < noticias.length; i++) {
    const item = noticias[i];
    try {
      const snap = await db.collection('posts')
        .where('enlaceOriginal', '==', item.url)
        .get();

      const chosenImage = GUARANTEED_IMAGES[i % GUARANTEED_IMAGES.length];
      item.imagenUrl = chosenImage; // Ensure JSON also has valid Unsplash URL

      if (snap.empty) {
        await db.collection('posts').add({
          titulo: item.titulo,
          extracto: item.resumen,
          contenido: `${item.resumen}\n\nFuente original: ${item.fuente}`,
          fuente: item.fuente,
          enlaceOriginal: item.url,
          imagenUrl: chosenImage,
          imageContain: false,
          activo: true, // Visible en el blog público
          createdAt: FieldValue.serverTimestamp()
        });
        noticiasCount++;
      } else {
        for (const doc of snap.docs) {
          await doc.ref.update({ imagenUrl: chosenImage, activo: true });
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

  console.log(`[Firestore Sync] Éxito: ${noticiasCount} noticia(s) sincronizada(s) con imágenes Unsplash en "posts" y ${alertasCount} aviso en "avisos".`);
}

module.exports = {
  syncToFirestore
};
