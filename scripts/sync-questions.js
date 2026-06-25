/**
 * Écrase les questions de Firestore par celles des fichiers scripts/questions/*.json
 *
 * Convertit le format {theme, questions: [{id, niveau, question, reponse, variantes, anecdote}]}
 * vers le format Firestore {theme, difficulte, question, reponses_acceptees, explication, time}.
 *
 * Usage:
 *   node scripts/sync-questions.js          (aperçu, ne touche pas Firestore)
 *   node scripts/sync-questions.js --apply   (supprime les questions existantes et importe les nouvelles)
 */

const fs = require('fs');
const path = require('path');

const QUESTIONS_DIR = path.join(__dirname, 'questions');
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
const apply = process.argv.includes('--apply');

// Les thèmes des fichiers JSON sont en minuscules ; l'app attend les libellés
// capitalisés définis dans src/types/index.ts (CATEGORIES).
const THEME_LABELS = {
  art: 'Art',
  'géographie': 'Géographie',
  histoire: 'Histoire',
  'littérature': 'Littérature',
  musique: 'Musique',
  nature: 'Nature',
  sciences: 'Sciences',
};

function loadAllQuestions() {
  const files = fs.readdirSync(QUESTIONS_DIR).filter((f) => f.endsWith('.json'));
  const all = [];

  files.forEach((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(QUESTIONS_DIR, file), 'utf-8'));
    const rawTheme = data.theme ?? path.basename(file, '.json');
    const theme = THEME_LABELS[rawTheme] ?? rawTheme;

    (data.questions ?? []).forEach((q) => {
      const reponses = [q.reponse, ...(q.variantes ?? [])].filter(Boolean);
      const reponses_acceptees = [...new Set(reponses)];

      all.push({
        theme,
        difficulte: q.niveau ?? 3,
        question: q.question,
        reponses_acceptees,
        explication: q.anecdote ?? '',
        time: 15,
      });
    });
  });

  return all;
}

async function main() {
  const questions = loadAllQuestions();
  console.log(`📋 ${questions.length} question(s) chargée(s) depuis ${QUESTIONS_DIR}\n`);

  const invalid = questions.filter((q) => !q.question || q.reponses_acceptees.length === 0);
  if (invalid.length > 0) {
    console.error(`❌ ${invalid.length} question(s) invalide(s) (question ou réponses manquantes).`);
    process.exit(1);
  }

  if (!apply) {
    console.log('👀 Aperçu (aucune écriture). Relance avec --apply pour écraser Firestore.\n');
    const parTheme = {};
    questions.forEach((q) => (parTheme[q.theme] = (parTheme[q.theme] ?? 0) + 1));
    console.table(parTheme);
    return;
  }

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error('❌ Clé de service introuvable : scripts/serviceAccountKey.json');
    process.exit(1);
  }

  const admin = require('firebase-admin');
  const serviceAccount = require(SERVICE_ACCOUNT_PATH);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();

  console.log('🗑️  Suppression des questions existantes...');
  const existing = await db.collection('questions').get();
  for (let i = 0; i < existing.docs.length; i += 500) {
    const batch = db.batch();
    existing.docs.slice(i, i + 500).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  console.log(`   ${existing.size} supprimée(s).\n`);

  console.log('📤 Import des nouvelles questions...');
  for (let i = 0; i < questions.length; i += 500) {
    const batch = db.batch();
    questions.slice(i, i + 500).forEach((q) => batch.set(db.collection('questions').doc(), q));
    await batch.commit();
    console.log(`   ✅ ${Math.min(i + 500, questions.length)}/${questions.length} importées...`);
  }

  console.log(`\n🎉 ${questions.length} question(s) importée(s) dans Firestore.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur :', err);
  process.exit(1);
});
