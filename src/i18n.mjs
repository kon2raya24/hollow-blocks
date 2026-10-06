// Languages. The game is written in Filipino; English is a dictionary keyed by the Filipino text
// (lang-en.mjs), so the data files and the server stay as they are and the words are swapped where
// they're shown. t('Kulang pa ng {n} barya', { n }) fills {n} in either language.
import { EN } from './lang-en.mjs';

export const LANGS = [['fil', 'Filipino'], ['en', 'English']];
let lang = 'fil';
export const setLang = (l) => { lang = l === 'en' ? 'en' : 'fil'; if (typeof document !== 'undefined') document.documentElement.lang = lang === 'en' ? 'en' : 'fil'; };
export const getLang = () => lang;
export function t(s, vars = null) {
  let out = lang === 'en' && EN[s] !== undefined ? EN[s] : s;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  // English plurals: {s} / {S} after a count is '' for one, 's' (or 'S') otherwise
  if (vars && vars.n !== undefined) out = out.replace(/\{s\}/g, +vars.n === 1 ? '' : 's').replace(/\{S\}/g, +vars.n === 1 ? '' : 'S');
  return out;
}
// The page's own words (index.html): every text and label that has an English line, swapped once at start.
const ATTRS = ['aria-label', 'title', 'placeholder', 'alt'];
export function translatePage(root) {
  if (lang !== 'en') return;
  const walk = root.ownerDocument.createTreeWalker(root, 4); // text nodes
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const s = n.nodeValue.trim();
    if (s && EN[s] !== undefined) n.nodeValue = n.nodeValue.replace(s, EN[s]);
  }
  for (const el of root.querySelectorAll('*')) for (const a of ATTRS) { const v = el.getAttribute(a); if (v && EN[v] !== undefined) el.setAttribute(a, EN[v]); }
}
