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
  check: (i) => `<circle cx="24" cy="24" r="18" fill="url(#g${i})"/><path d="M15 24l7 7 12-14" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>`,
  play: (i) => `<path d="M15 9l24 15-24 15z" fill="url(#g${i})"/>`,
  pause: (i) => `<path d="M12 9h9v30h-9zM27 9h9v30h-9z" fill="url(#g${i})"/>`,
  share: (i) => `<circle cx="13" cy="24" r="6" fill="url(#g${i})"/><circle cx="35" cy="12" r="6" fill="url(#g${i})"/><circle cx="35" cy="36" r="6" fill="url(#g${i})"/><path d="M18 21l12-6M18 27l12 6" fill="none" stroke="${INK}" stroke-width="3"/>`,
  ghost: (i) => `<path d="M10 40V22a14 14 0 0 1 28 0v18l-5-4-5 4-4-4-4 4-5-4z" fill="url(#s${i})" fill-opacity=".9"/><circle cx="19" cy="22" r="3" fill="${INK}"/><circle cx="29" cy="22" r="3" fill="${INK}"/>`,
  vs: (i) => `<path d="M8 10l18 18-4 4L4 14z" fill="url(#s${i})"/><path d="M40 10L22 28l4 4 18-18z" fill="url(#s${i})"/><path d="M14 30l4 4-8 8-4-4zM34 30l-4 4 8 8 4-4z" fill="url(#g${i})"/>`,
  blueprint: (i) => `<path d="M7 9h28l6 6v24H7z" fill="#3a6aa8"/><path d="M13 16h16M13 22h22M13 28h10M27 28h8v6h-8z" fill="none" stroke="#e8f0ff" stroke-width="2.2"/>`,
  pad: (i) => `<path d="M8 18c2-5 8-6 16-6s14 1 16 6l4 14c1 5-5 7-8 3l-4-5H16l-4 5c-3 4-9 2-8-3z" fill="url(#s${i})"/><path d="M14 20v8M10 24h8" stroke="${INK}" stroke-width="3"/><circle cx="32" cy="21" r="2.5" fill="url(#r${i})"/><circle cx="36" cy="26" r="2.5" fill="url(#g${i})"/>`,
  keyb: (i) => `<path d="M4 14h40v22H4z" fill="url(#s${i})"/><path d="M9 19h4v4H9zM16 19h4v4h-4zM23 19h4v4h-4zM30 19h4v4h-4zM37 19h3v4h-3zM12 29h24v3H12z" fill="${INK}" stroke="none"/>`,
  replay: (i) => `<path d="M24 8a16 16 0 1 1-15 10" fill="none" stroke="url(#g${i})" stroke-width="5" stroke-linecap="round"/><path d="M4 10l6 10 8-7z" fill="url(#g${i})"/><path d="M20 17l11 7-11 7z" fill="url(#r${i})"/>`,
};
let n = 0;
// an icon as an SVG string; `size` in CSS pixels
export function icon(name, size = 26) {
  const i = n++, body = (P[name] || P.toolbox)(i);
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${defs(i)}<g stroke="${INK}" stroke-width="2.5" stroke-linejoin="round">${body}</g></svg>`;
}

// A rival's portrait: a face under a hard hat in their colour.
export function portrait(color = '#ffd23f', size = 64) {
  const i = n++;
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${defs(i)}<g stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"><path d="M10 46c1-8 6-12 14-12s13 4 14 12z" fill="#3a4a5a"/><ellipse cx="24" cy="26" rx="10" ry="11" fill="#c8895a"/><circle cx="20" cy="26" r="1.6" fill="${INK}"/><circle cx="28" cy="26" r="1.6" fill="${INK}"/><path d="M20 31c2 2 6 2 8 0" fill="none"/><path d="M11 20a13 12 0 0 1 26 0z" fill="${color}"/><path d="M8 20h32v3H8z" fill="${color}"/><path d="M22 9h4v11h-4z" fill="#fff" fill-opacity=".35" stroke="none"/></g></svg>`;
}
