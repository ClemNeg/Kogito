/**
 * Import questions from a JSON file into Firestore.
 *
 * Usage:
 *   node scripts/import-questions.js questions.json
 *   node scripts/import-questions.js questions.json --replace
 *
 * Format attendu :
 * [
 *   {
 *     "theme": "Géographie",
 *     "difficulte": 1,           (1 à 5, optionnel, défaut: 3)
 *     "question": "...",
 *     "reponses_acceptees": ["Paris", "paris"],
 *     "explication": "...",      (optionnel)
 *     "time": 20                 (secondes, optionnel, défaut: 15)
 *   }
 * ]
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');

const args = process.argv.slice(2);
const jsonFile = args.find((a) => !a.startsWith('--'));
const shouldReplace = args.includes('--replace');

if (!jsonFile) {
  console.error('❌ Usage: node scripts/import-questions.js <fichier.json> [--replace]');
  process.exit(1);
}

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error('❌ Clé de service introuvable : scripts/serviceAccountKey.json');
  console.error('   → Firebase Console → Paramètres du projet → Comptes de service → Générer une clé privée');
  process.exit(1);
}

const jsonPath = path.resolve(jsonFile);
if (!fs.existsSync(jsonPath)) {
  console.error(`❌ Fichier introuvable : ${jsonPath}`);
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function validate(q, index) {
  const errors = [];
  if (!q.question || typeof q.question !== 'string') errors.push('question manquante');
  if (!q.theme || typeof q.theme !== 'string') errors.push('theme manquant');
  if (!Array.isArray(q.reponses_acceptees) || q.reponses_acceptees.length === 0)
    errors.push('reponses_acceptees doit être un tableau non vide');
  if (q.difficulte !== undefined && typeof q.difficulte !== 'number')
    errors.push('difficulte doit être un nombre');
  if (q.time !== undefined && (typeof q.time !== 'number' || q.time < 5 || q.time > 120))
    errors.push('time doit être entre 5 et 120 secondes');
  return errors;
}

async function importQuestions() {
  let questions;
  try {
    questions = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch (e) {
    console.error('❌ Erreur de lecture du JSON :', e.message);
    process.exit(1);
  }

  if (!Array.isArray(questions)) {
    console.error('❌ Le fichier JSON doit contenir un tableau.');
    process.exit(1);
  }

  console.log(`\n📋 ${questions.length} question(s) trouvée(s)\n`);

  let hasErrors = false;
  questions.forEach((q, i) => {
    const errors = validate(q, i);
    if (errors.length > 0) {
      console.error(`❌ Question ${i + 1} (${q.question?.slice(0, 40) ?? '?'}) :`);
      errors.forEach((e) => console.error(`   - ${e}`));
      hasErrors = true;
    }
  });

  if (hasErrors) {
    console.error('\n❌ Corrige les erreurs avant d\'importer.');
    process.exit(1);
  }

  console.log('✅ Validation OK\n');

  if (shouldReplace) {
    console.log('🗑️  Suppression des questions existantes...');
    const existing = await db.collection('questions').get();
    const deleteBatch = db.batch();
    existing.docs.forEach((doc) => deleteBatch.delete(doc.ref));
    await deleteBatch.commit();
    console.log(`   ${existing.size} supprimée(s).\n`);
  }

  const BATCH_SIZE = 500;
  let count = 0;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = questions.slice(i, i + BATCH_SIZE);
    chunk.forEach((q) => {
      const ref = db.collection('questions').doc();
      batch.set(ref, {
        theme: q.theme,
        difficulte: Math.max(1, Math.min(10, q.difficulte ?? 5)),
        question: q.question,
        reponses_acceptees: q.reponses_acceptees,
        explication: q.explication ?? '',
        time: q.time ?? 15,
      });
    });
    await batch.commit();
    count += chunk.length;
    console.log(`   ✅ ${count}/${questions.length} importées...`);
  }

  console.log(`\n🎉 ${count} question(s) importée(s) dans Firestore.\n`);
  process.exit(0);
}

importQuestions().catch((err) => {
  console.error('❌ Erreur :', err);
  process.exit(1);
});
