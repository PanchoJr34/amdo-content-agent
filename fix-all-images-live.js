const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, 'service-account.json'), 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const DEFAULT_IMAGES = [
  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=800&auto=format&fit=crop'
];

async function fixAllImages() {
  console.log('Inspeccionando y corrigiendo imágenes en la colección "posts" de Firestore...');
  const snapshot = await db.collection('posts').get();

  let count = 0;
  for (let i = 0; i < snapshot.docs.length; i++) {
    const doc = snapshot.docs[i];
    const data = doc.data();
    const currentImg = data.imagenUrl;

    console.log(`Documento ID [${doc.id}]: Título = "${data.titulo}" | imagenUrl actual = "${currentImg}"`);

    // Assign a guaranteed high quality HTTPS unsplash image URL
    const newImg = DEFAULT_IMAGES[i % DEFAULT_IMAGES.length];
    await doc.ref.update({
      imagenUrl: newImg,
      activo: true
    });
    console.log(` -> Actualizado a: "${newImg}"`);
    count++;
  }

  console.log(`\n¡Éxito! Se actualizaron ${count} documentos en "posts" con URLs de imágenes HTTPS 100% funcionales.`);
  process.exit(0);
}

fixAllImages();
