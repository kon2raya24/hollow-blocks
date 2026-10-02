// Online: the account, the cloud save and the leaderboards, through the server (api/_hb.mjs). Only the
// session token is kept in the browser; when the browser forgets it, logging in again brings back the
// progress and the board places, which live on the server.
const SKEY = 'hollowblocks.session';

// The boards: each mode with a board, how its value reads, and whether it splits by difficulty.
export const RANKED = { bahay: 'Bahay', karera: 'Karera', bagyo: 'Bagyo', deadline: 'Deadline', daily: 'Daily', lingguhan: 'Lingguhan' };
export const byDiff = (mode) => ['bahay', 'karera', 'bagyo', 'deadline'].includes(mode);

export function createOnline(base) {
  let sess = null;
  try { sess = JSON.parse(localStorage.getItem(SKEY)); } catch { /* none */ }
  const keep = (s) => { sess = s; try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch { /* storage off: this tab only */ } };
  async function call(route, { method = 'GET', body, query = {} } = {}) {
    try {
      const res = await fetch(`${base}/api/hb?${new URLSearchParams({ r: route, ...query })}`, {
        method, body: body ? JSON.stringify(body) : undefined,
        headers: { 'Content-Type': 'application/json', ...(sess ? { Authorization: `Bearer ${sess.token}` } : {}) },
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401 && sess && route !== 'login' && route !== 'register') keep(null); // the session ended
      return { ok: res.ok, status: res.status, ...json };
    } catch {
      return { ok: false, status: 0, error: 'Walang koneksyon. Subukan ulit.' };
    }
  }
  async function enter(route, name, pass) {
    const r = await call(route, { method: 'POST', body: { name, pass } });
    if (r.ok) keep({ token: r.token, name: r.name });
    return r;
  }
  return {
    get user() { return sess ? sess.name : null; },
    register: (name, pass) => enter('register', name, pass),
    login: (name, pass) => enter('login', name, pass),
    async logout() { await call('logout', { method: 'POST', body: {} }); keep(null); },
    pull: () => call('save'),
    push: (data) => call('save', { method: 'POST', body: { data } }),
    submit: (code) => call('score', { method: 'POST', body: { code } }),
    board: (b) => call('board', { query: { b } }),
    replay: (b, u) => call('replay', { query: { b, u } }),
  };
}
