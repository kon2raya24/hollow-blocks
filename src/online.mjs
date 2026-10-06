// Online: the account, the cloud save and the leaderboards, through the server (api/_hb.mjs). Only the
// session token is kept in the browser; when the browser forgets it, logging in again brings back the
// progress and the board places, which live on the server.
import { solve } from './pow.mjs';
const SKEY = 'hollowblocks.session';

// The boards: each mode with a board, how its value reads, and whether it splits by difficulty.
export const RANKED = { bahay: 'Bahay', klasiko: 'Klasiko', karera: 'Karera', bagyo: 'Bagyo', deadline: 'Deadline', daily: 'Daily', lingguhan: 'Lingguhan' };
export const byDiff = (mode) => ['bahay', 'klasiko', 'karera', 'bagyo', 'deadline'].includes(mode);

export function createOnline(base) {
  let sess = null;
  try { sess = JSON.parse(localStorage.getItem(SKEY)); } catch { /* none */ }
  const keep = (s) => { sess = s; try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch { /* storage off: this tab only */ } };
  // anon: no token, so the answer is the same for everyone and the edge can cache it
  async function call(route, { method = 'GET', body, query = {}, anon = false } = {}) {
    try {
      const res = await fetch(`${base}/api/hb?${new URLSearchParams({ r: route, ...query })}`, {
        method, body: body ? JSON.stringify(body) : undefined,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(sess && !anon ? { Authorization: `Bearer ${sess.token}` } : {}) },
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401 && sess && route !== 'login' && route !== 'register') keep(null); // the session ended
      return { ok: res.ok, status: res.status, ...json };
    } catch {
      return { ok: false, status: 0, error: 'Walang koneksyon. Subukan ulit.' };
    }
  }
  async function enter(route, body) {
    const r = await call(route, { method: 'POST', body });
    if (r.ok) keep({ token: r.token, name: r.name });
    return r;
  }
  // the sign-up puzzle, fetched and solved ahead (while the name is typed); a new one when it's used
  let puzzle = null;
  const prepare = () => (puzzle ||= call('challenge', { anon: true }).then(async (c) => (c.ok ? { c: c.c, n: await solve(c.c, c.bits) } : null)));
  return {
    get user() { return sess ? sess.name : null; },
    prepare,
    async register(name, pass, website = '') {
      const pow = await prepare();
      puzzle = null;
      if (!pow) return { ok: false, error: 'Walang koneksyon. Subukan ulit.' };
      return enter('register', { name, pass, website, pow });
    },
    login: (name, pass) => enter('login', { name, pass }),
    async logout() { await call('logout', { method: 'POST', body: {} }); keep(null); },
    pull: () => call('save'),
    push: (data) => call('save', { method: 'POST', body: { data } }),
    submit: (code) => call('score', { method: 'POST', body: { code } }),
    board: (b) => call('board', { query: { b }, anon: true }),
    rank: (b) => call('rank', { query: { b } }),
    replay: (b, u) => call('replay', { query: { b, u }, anon: true }),
    // a game started: counted by day, mode and language, with nothing about the player
    play: (mode, lang) => call('play', { method: 'POST', body: { mode, lang }, anon: true }),
  };
}
