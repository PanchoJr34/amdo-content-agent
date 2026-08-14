const fs = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { generateExtracto, generateContenido } = require('./summarizer');

// 20 COMPLETELY DISTINCT, HIGH-RESOLUTION INDUSTRIAL & PHARMA PACKAGING IMAGES
const UNIQUE_INDUSTRY_IMAGES = [
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=800&auto=format&fit=crop'
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

  console.log('\n[Firestore Sync] Sincronizando elementos con imágenes únicas y notas extendidas a Firestore en vivo...');

  // 1. Sincronizar Noticias -> Colección 'posts'
  let noticiasCount = 0;
  for (let i = 0; i < noticias.length; i++) {
    const item = noticias[i];
    try {
      const snap = await db.collection('posts')
        .where('enlaceOriginal', '==', item.url)
        .get();

      // Assign a UNIQUE image per article index
      const uniqueImage = UNIQUE_INDUSTRY_IMAGES[i % UNIQUE_INDUSTRY_IMAGES.length];
      item.imagenUrl = uniqueImage;

      const extractoExtendido = generateExtracto(item.titulo, item.resumen);
      const contenidoDetallado = generateContenido(item.titulo, item.resumen);

      item.resumen = extractoExtendido;

      if (snap.empty) {
        await db.collection('posts').add({
          titulo: item.titulo,
          extracto: extractoExtendido,
          contenido: contenidoDetallado,
          fuente: item.fuente,
          enlaceOriginal: item.url,
          imagenUrl: uniqueImage,
          imageContain: false,
          activo: true, // Visible en el blog público
          createdAt: FieldValue.serverTimestamp()
        });
        noticiasCount++;
      } else {
        for (const doc of snap.docs) {
          await doc.ref.update({
            imagenUrl: uniqueImage,
            extracto: extractoExtendido,
            contenido: contenidoDetallado,
            activo: true
          });
        }
      }
    } catch (e) {
      console.error(` Error al guardar noticia "${item.titulo}":`, e.message);
    }
  }

  // Also update any legacy posts in 'posts' to ensure unique images and detailed content
  try {
    const allPostsSnap = await db.collection('posts').get();
    for (let idx = 0; idx < allPostsSnap.docs.length; idx++) {
      const doc = allPostsSnap.docs[idx];
      const data = doc.data();
      const uniqueImg = UNIQUE_INDUSTRY_IMAGES[idx % UNIQUE_INDUSTRY_IMAGES.length];

      const richExtracto = generateExtracto(data.titulo, data.extracto || data.contenido || '');
      const richContenido = data.contenido && data.contenido.length > 200
        ? data.contenido
        : generateContenido(data.titulo, data.extracto || '');

      await doc.ref.update({
        imagenUrl: uniqueImg,
        extracto: richExtracto,
        contenido: richContenido,
        activo: true
      });
    }
  } catch (e) {
    console.error('Error al actualizar posts legacy:', e.message);
  }

  // 2. Sincronizar Alertas Sanitarias -> Colección 'avisos'
  let alertasCount = 0;
  if (alertas.length > 0) {
    const titulosAlertas = alertas.map(a => a.titulo.replace(/alerta sanitaria:\s*/gi, '')).join(', ');
    const mensajeConsolidado = `Avisos recientes de COFEPRIS sobre ${titulosAlertas}. Se recomienda a la industria y farmacias verificar lotes normativos.`;

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

  console.log(`[Firestore Sync] Éxito: Sincronizados ${noticias.length} artículos con imágenes ÚNICAS e historia detallada en "posts".`);
}

module.exports = {
  syncToFirestore
};
