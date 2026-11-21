#!/usr/bin/env node
// Atualiza em sincronia todos os ?v= do index.html e a constante VER do sw.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const htmlPath = path.join(ROOT, 'index.html');
const swPath = path.join(ROOT, 'sw.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const sw = fs.readFileSync(swPath, 'utf8');

const verMatch = sw.match(/const VER='([^']+)'/);
if (!verMatch) {
  console.error('Não foi possível encontrar const VER em sw.js');
  process.exit(1);
}
const currentVer = verMatch[1];

function nextVersion(arg) {
  if (arg) {
    if (!/^\w+$/.test(arg)) {
      console.error('Versão inválida (use apenas letras, números ou _):', arg);
      process.exit(1);
    }
    return arg;
  }
  const now = new Date();
  const base =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  if (!currentVer.startsWith(base)) return base;
  const suffix = currentVer.slice(base.length);
  if (!suffix) return base + 'a';
  const last = suffix.slice(-1);
  if (/^[a-y]$/i.test(last)) {
    return base + suffix.slice(0, -1) + String.fromCharCode(last.charCodeAt(0) + 1);
  }
  return base + suffix + 'a';
}

const nextVer = nextVersion(process.argv[2]);

// Valida que todos os arquivos de css/ e js/ estão referenciados em index.html e sw.js
const assetFiles = ['css', 'js'].flatMap((dir) => {
  const full = path.join(ROOT, dir);
  return fs.existsSync(full) ? fs.readdirSync(full).sort().map((f) => `${dir}/${f}`) : [];
});

const missingHtml = assetFiles.filter((f) => !new RegExp(`["']${f}\\?v=\\w+["']`).test(html));
const missingSw = assetFiles.filter((f) => !sw.includes(f));
if (missingHtml.length || missingSw.length) {
  if (missingHtml.length) console.error('Arquivos ausentes no index.html:', missingHtml.join(', '));
  if (missingSw.length) console.error('Arquivos ausentes no sw.js:', missingSw.join(', '));
  process.exit(1);
}

const updatedHtml = html.replace(/((?:css|js)\/[^"'?\s]+\?v=)\w+/g, `$1${nextVer}`);
const updatedSw = sw.replace(/(const VER=')[^']+(')/, `$1${nextVer}$2`);

fs.writeFileSync(htmlPath, updatedHtml, 'utf8');
fs.writeFileSync(swPath, updatedSw, 'utf8');

console.log(`Versão atualizada: ${currentVer} -> ${nextVer} (${assetFiles.length} arquivos validados)`);
