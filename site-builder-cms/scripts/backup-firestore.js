// Este script usaria o SDK Admin do Firebase para exportar dados do Firestore para um bucket do Storage.
// Requer o pacote '@google-cloud/firestore'

const firestore = require('@google-cloud/firestore');
const client = new firestore.v1.FirestoreAdminClient();

const projectId = process.env.GCP_PROJECT;
const bucket = `gs://${projectId}-backups`;

async function backup() {
  const databaseName = client.databasePath(projectId, '(default)');

  try {
    const [operation] = await client.exportDocuments({
      name: databaseName,
      outputUriPrefix: bucket,
      collectionIds: [] // Deixe vazio para fazer backup de tudo
    });
    console.log(`Operação de backup iniciada: ${operation.name}`);
  } catch (err) {
    console.error(err);
    throw new Error('Falha ao iniciar a operação de backup.');
  }
}

backup();
