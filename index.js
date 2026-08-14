const fs = require('fs');
const path = require('path');
const scrapeCofeprisNoticias = require('./scrapers/cofepris-noticias');
const scrapeCofeprisAlertas = require('./scrapers/cofepris-alertas');
const scrapeAmbientePlastico = require('./scrapers/ambiente-plastico');
const scrapePtMexico = require('./scrapers/pt-mexico');
const scrapeInterempresasEnvase = require('./scrapers/interempresas-envase');
const { deduplicateList } = require('./utils/deduplicator');
const { syncToFirestore } = require('./utils/firestore-sync');

async function runAgent() {
  console.log('====================================================');
  console.log('  AGENTE AUTOMATIZADO DE CONTENIDO - GRUPO AMDO  ');
  console.log('====================================================');
  console.log(`Fecha de ejecución: ${new Date().toISOString().split('T')[0]}`);
  console.log('Buscando contenido de los últimos 30 días...\n');

  const refDate = new Date();

  // 1. Ejecutar scrapers de Noticias
  const rawNoticiasCofepris = await scrapeCofeprisNoticias(refDate);
  const rawNoticiasAP = await scrapeAmbientePlastico(refDate);
  const rawNoticiasPT = await scrapePtMexico(refDate);
  const rawNoticiasIE = await scrapeInterempresasEnvase(refDate);

  // 2. Ejecutar scraper de Alertas
  const rawAlertasCofepris = await scrapeCofeprisAlertas(refDate);

  // 3. Agrupar y desduplicar Noticias
  const allNoticiasRaw = [
    ...rawNoticiasCofepris,
    ...rawNoticiasAP,
    ...rawNoticiasPT,
    ...rawNoticiasIE
  ];

  const noticiasDeduplicadas = deduplicateList(allNoticiasRaw);

  // 4. Agrupar y desduplicar Alertas Sanitarias
  const alertasDeduplicadas = deduplicateList(rawAlertasCofepris);

  // 5. Ordenar por fecha descendente (más reciente primero)
  const sortedNoticias = noticiasDeduplicadas.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const sortedAlertas = alertasDeduplicadas.sort((a, b) => b.fecha.localeCompare(a.fecha));

  // 6. Escribir archivos de salida JSON
  const noticiasPath = path.join(__dirname, 'noticias.json');
  const alertasPath = path.join(__dirname, 'alertas.json');

  fs.writeFileSync(noticiasPath, JSON.stringify(sortedNoticias, null, 2), 'utf8');
  fs.writeFileSync(alertasPath, JSON.stringify(sortedAlertas, null, 2), 'utf8');

  // 7. Sincronizar directamente a la base de datos de Firestore
  await syncToFirestore(sortedNoticias, sortedAlertas);

  // 8. Generar e imprimir resumen en consola
  console.log('\n====================================================');
  console.log('              RESUMEN DE RESULTADOS               ');
  console.log('====================================================');

  const countsBySource = {
    'COFEPRIS (Noticias)': rawNoticiasCofepris.length,
    'Ambiente Plástico': rawNoticiasAP.length,
    'PT México': rawNoticiasPT.length,
    'Interempresas Envase': rawNoticiasIE.length,
    'COFEPRIS (Alertas Sanitarias)': rawAlertasCofepris.length
  };

  console.log('\n[ Elementos encontrados por fuente ]');
  console.table(countsBySource);

  console.log('\n[ Resumen por Categoría y Salida ]');
  console.log(`- Categoría "noticia": ${sortedNoticias.length} elemento(s) -> guardado en ${noticiasPath}`);
  console.log(`- Categoría "alerta-sanitaria": ${sortedAlertas.length} elemento(s) -> guardado en ${alertasPath}`);
  console.log('\n¡Proceso completado exitosamente con éxito!');
}

runAgent().catch(err => {
  console.error('\n[Error fatal en el agente]:', err);
  process.exit(1);
});
