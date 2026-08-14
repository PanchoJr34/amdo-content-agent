const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const GUARANTEED_IMAGES = [
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=800&auto=format&fit=crop'
];

async function updateAllToUnsplash() {
  console.log('--- 1. Actualizando noticias.json ---');
  const noticiasPath = path.join(__dirname, 'noticias.json');
  if (fs.existsSync(noticiasPath)) {
    const noticias = JSON.parse(fs.readFileSync(noticiasPath, 'utf8'));
    noticias.forEach((item, index) => {
      item.imagenUrl = GUARANTEED_IMAGES[index % GUARANTEED_IMAGES.length];
    });
    fs.writeFileSync(noticiasPath, JSON.stringify(noticias, null, 2), 'utf8');
    console.log(`¡Éxito! Actualizadas ${noticias.length} noticias en noticias.json con imágenes Unsplash.`);
  }

  console.log('\n--- 2. Actualizando colección "posts" en Firestore ---');
  const serviceAccountPath = path.join(__dirname, 'service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    initializeApp({ credential: cert(serviceAccount) });
    const db = getFirestore();

    const snapshot = await db.collection('posts').get();
    let count = 0;
    for (let i = 0; i < snapshot.docs.length; i++) {
      const doc = snapshot.docs[i];
      const img = GUARANTEED_IMAGES[i % GUARANTEED_IMAGES.length];
      await doc.ref.update({
        imagenUrl: img,
        activo: true
      });
      count++;
    }
    console.log(`¡Éxito! Actualizados ${count} documentos en Firestore "posts" con imágenes Unsplash.`);
  }

  process.exit(0);
}

updateAllToUnsplash();
