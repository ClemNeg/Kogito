/**
 * Inventaire des questions par thème et par niveau de difficulté.
 *
 * Usage:
 *   node scripts/inventory-questions.js
 *   node scripts/inventory-questions.js scripts/questions
 */

const fs = require('fs');
const path = require('path');

const dir = path.resolve(process.argv[2] || path.join(__dirname, 'questions'));

if (!fs.existsSync(dir)) {
  console.error(`❌ Dossier introuvable : ${dir}`);
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

if (files.length === 0) {
  console.error(`❌ Aucun fichier .json dans ${dir}`);
  process.exit(1);
}

const niveaux = [];
const parTheme = {}; // theme -> { niveau -> count, total }
let totalGlobal = 0;

files.forEach((file) => {
  const filePath = path.join(dir, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.error(`⚠️  ${file} : JSON invalide (${e.message})`);
    return;
  }

  const theme = data.theme ?? path.basename(file, '.json');
  const questions = Array.isArray(data.questions) ? data.questions : [];

  if (!parTheme[theme]) parTheme[theme] = { total: 0 };

  questions.forEach((q) => {
    const niveau = q.niveau ?? '?';
    if (!niveaux.includes(niveau)) niveaux.push(niveau);
    parTheme[theme][niveau] = (parTheme[theme][niveau] ?? 0) + 1;
    parTheme[theme].total += 1;
    totalGlobal += 1;
  });
});

niveaux.sort((a, b) => (a === '?' ? 1 : b === '?' ? -1 : a - b));

const themes = Object.keys(parTheme).sort();
const colWidth = 6;
const themeColWidth = Math.max(12, ...themes.map((t) => t.length + 1));

const pad = (s, w) => String(s).padEnd(w, ' ');
const padNum = (n, w) => String(n).padStart(w, ' ');

let header = pad('Thème', themeColWidth);
niveaux.forEach((n) => (header += padNum(`N${n}`, colWidth)));
header += padNum('Total', colWidth + 2);
console.log('\n' + header);
console.log('-'.repeat(header.length));

themes.forEach((theme) => {
  let row = pad(theme, themeColWidth);
  niveaux.forEach((n) => (row += padNum(parTheme[theme][n] ?? 0, colWidth)));
  row += padNum(parTheme[theme].total, colWidth + 2);
  console.log(row);
});

console.log('-'.repeat(header.length));
let totalRow = pad('TOTAL', themeColWidth);
niveaux.forEach((n) => {
  const sum = themes.reduce((acc, t) => acc + (parTheme[t][n] ?? 0), 0);
  totalRow += padNum(sum, colWidth);
});
totalRow += padNum(totalGlobal, colWidth + 2);
console.log(totalRow);
console.log(`\n📊 ${totalGlobal} question(s) au total dans ${themes.length} thème(s) (${files.length} fichier(s))\n`);
