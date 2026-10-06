// node tools/portal.mjs [crazygames] — the game for a web portal: dist/<portal>/ and dist/hollow-blocks-<portal>.zip.
// src/portal.mjs names the portal, so the game starts in English and leaves out our ads, accounts, Ranking,
// outside links and service worker; index.html loses our ad tag, its CSP, the app manifest and the social
// cards. Everything else is the game as it is on our own site.
import { cpSync, rmSync, mkdirSync, writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const portal = process.argv[2] || 'crazygames';
const out = `dist/${portal}`, zip = `dist/hollow-blocks-${portal}.zip`;
rmSync(out, { recursive: true, force: true }); rmSync(zip, { force: true }); mkdirSync(out, { recursive: true });
for (const p of ['src', 'assets', 'icons']) cpSync(p, join(out, p), { recursive: true });
writeFileSync(join(out, 'src/portal.mjs'), `// written by tools/portal.mjs: this copy is the ${portal} build\nexport const PORTAL = '${portal}';\n`);
let html = readFileSync('index.html', 'utf8');
for (const re of [/<meta name="google-adsense-account"[^>]*>\n/, /<meta http-equiv="Content-Security-Policy"[^>]*>\n/, /<link rel="manifest"[^>]*>\n/, /<meta property="og:[^>]*>\n/g, /<meta name="twitter:[^>]*>\n/g]) {
  if (!re.test(html)) throw new Error(`index.html changed: ${re}`);
  html = html.replace(re, '');
}
writeFileSync(join(out, 'index.html'), html);
// the numbers the portal checks: total size, file count (CrazyGames: ≤ 250 MB, ≤ 1500 files)
let bytes = 0, files = 0;
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f), s = statSync(p); if (s.isDirectory()) walk(p); else { bytes += s.size; files++; } } };
walk(out);
execSync(`cd ${out} && zip -qr ../${zip.split('/').pop()} .`);
console.log(`${out}: ${files} files, ${(bytes / 1e6).toFixed(1)} MB → ${zip} ${(statSync(zip).size / 1e6).toFixed(1)} MB`);
