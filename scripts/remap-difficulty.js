/**
 * Remappe les niveaux de difficulté de l'échelle 1-10 vers 1-5.
 *   1/2 -> 1
 *   3/4 -> 2
 *   5/6 -> 3
 *   7/8 -> 4
 *   9/10 -> 5
 *
 * Modifie les fichiers en place dans scripts/questions/*.json.
 *
 * Usage:
 *   node scripts/remap-difficulty.js
 *   node scripts/remap-difficulty.js scripts/questions
 */

const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || path.join(__dirname, 'questions'));

if (!fs.existsSync(dir)) {
  console.error(`❌ Dossier introuvable : ${dir}`);
  process.exit(1);
}

function remap(niveau) {
  return Math.ceil(niveau / 2);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

if (files.length === 0) {
  console.error(`❌ Aucun fichier .json dans ${dir}`);
  process.exit(1);
}

files.forEach((file) => {
  const filePath = path.join(dir, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error(`⚠️  ${file} : JSON invalide (${e.message})`);
    return;
  }

  const questions = Array.isArray(data.questions) ? data.questions : [];
  let changed = 0;

  questions.forEach((q) => {
    if (typeof q.niveau === 'number') {
      const newNiveau = remap(q.niveau);
      if (newNiveau !== q.niveau) changed++;
      q.niveau = newNiveau;
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`✅ ${file} : ${changed}/${questions.length} question(s) remappée(s)`);
});

console.log('\n🎉 Remappage terminé.\n');
