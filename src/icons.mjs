// The game's icons, drawn as inline SVG in its own style (a warm gold body, a dark ink outline, a shine),
// so they look the same on every device instead of whatever emoji the system has.
const INK = '#120d14';
const defs = (id) => `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe0"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#e8741c"/></linearGradient><linearGradient id="s${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f4"/><stop offset="1" stop-color="#8a9498"/></linearGradient><linearGradient id="r${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a5a"/><stop offset="1" stop-color="#b8321e"/></linearGradient></defs>`;
const P = {
  martilyo: (i) => `<path d="M14 9h16l4 4v6H18l-4-3z" fill="url(#s${i})"/><path d="M26 19l-12 21a3 3 0 0 0 5 3l12-21z" fill="url(#g${i})"/>`,
  semento: (i) => `<path d="M9 14h26l-3 25H12z" fill="url(#r${i})"/><path d="M8 12c4-4 24-4 28 0" fill="none" stroke="${INK}" stroke-width="3"/><path d="M12 22h20" stroke="#fff" stroke-opacity=".5" stroke-width="2"/><path d="M14 14c2 3 14 3 16 0z" fill="#b8bab8"/>`,
  kreyn: (i) => `<path d="M6 8h34v6H6z" fill="url(#g${i})"/><path d="M30 14v8" stroke="${INK}" stroke-width="3"/><path d="M30 22c-6 0-6 10 0 10s6-4 6-4" fill="none" stroke="url(#s${i})" stroke-width="5" stroke-linecap="round"/><path d="M8 14v28h6V14" fill="url(#g${i})"/>`,
  pison: (i) => `<circle cx="13" cy="33" r="8" fill="url(#s${i})"/><path d="M19 18h17v15H19z" fill="url(#g${i})"/><path d="M22 10h11v8H22z" fill="#4a6a8a"/><circle cx="33" cy="35" r="5" fill="#2a2a2a"/>`,
  merienda: (i) => `<path d="M8 24c0-8 7-12 16-12s16 4 16 12c0 6-5 10-16 10S8 30 8 24z" fill="url(#g${i})"/><path d="M14 20c3 2 6 2 9 0M25 20c3 2 6 2 9 0" fill="none" stroke="#a8541c" stroke-width="2.5" stroke-linecap="round"/><path d="M8 38h32" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  toolbox: (i) => `<path d="M17 15v-4h14v4" fill="none" stroke="${INK}" stroke-width="3.5"/><path d="M6 15h36v24H6z" fill="url(#r${i})"/><path d="M6 24h36" stroke="${INK}" stroke-width="2.5"/><path d="M20 21h8v6h-8z" fill="url(#g${i})"/>`,
  lock: (i) => `<path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="url(#s${i})" stroke-width="5"/><path d="M10 21h28v20H10z" fill="url(#g${i})"/><circle cx="24" cy="30" r="3" fill="${INK}"/>`,
  target: (i) => `<circle cx="24" cy="24" r="17" fill="url(#r${i})"/><circle cx="24" cy="24" r="11" fill="#fff8e1"/><circle cx="24" cy="24" r="5" fill="url(#r${i})"/>`,
  warn: (i) => `<path d="M24 6l19 34H5z" fill="url(#g${i})"/><path d="M24 17v11" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="34" r="2.5" fill="${INK}"/>`,
  star: (i) => `<path d="M24 5l5.6 12.2 13.4 1.4-10 9 2.9 13.2L24 34l-11.9 6.8L15 27.6l-10-9 13.4-1.4z" fill="url(#g${i})"/>`,
};
let n = 0;
// an icon as an SVG string; `size` in CSS pixels
export function icon(name, size = 26) {
  const i = n++, body = (P[name] || P.toolbox)(i);
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${defs(i)}<g stroke="${INK}" stroke-width="2.5" stroke-linejoin="round">${body}</g></svg>`;
}
