// Rewarded ads, pure: what is on offer, the daily caps, and what each gives. An ad is only ever a
// button the player chooses (never a banner, never mid-game), nothing is offered before the third
// game, and the whole thing can be switched off in Settings. Nothing here touches a ranked game: the
// rewards are barya, XP, a look to try, a saved streak, and a tool to start an (unranked) contract.
// The page plays the ad through a provider: a real network once one is connected, or ?ads=test.
import { dateKey } from './progress.mjs';

export const OFFERS = {
  double: { name: 'Doblehin ang barya', perDay: 5 }, // the results screen: the game's barya again
  barya: { name: 'Libreng barya', perDay: 3, coins: 50 }, // the Tindahan
  overtime: { name: 'Overtime', perDay: 1, games: 3 }, // the Tindahan: 2× XP for the next three games
  trial: { name: 'Subukan nang 24 oras', perDay: 1, hours: 24 }, // a Tindahan item, worn for a day
  tool: { name: 'Gamit sa simula', perDay: 5 }, // a Proyekto contract starts with a tool
  streak: { name: 'Iligtas ang streak', perDay: 1 }, // the day a streak breaks
};
export const DAILY_MAX = 12, MIN_GAMES = 3;

// ads: { day, n: { kind: times today }, total } — a new day starts the counts again
export const today = (ads, now = Date.now()) => (ads && ads.day === dateKey(now) ? ads : { day: dateKey(now), n: {}, total: 0 });
// p: { ads, games, on (the Settings switch) }
export function canOffer(kind, p, now = Date.now()) {
  const o = OFFERS[kind], a = today(p.ads, now);
  return !!o && p.on !== false && (p.games || 0) >= MIN_GAMES && (a.n[kind] || 0) < o.perDay && a.total < DAILY_MAX;
}
export const left = (kind, ads, now = Date.now()) => Math.max(0, OFFERS[kind].perDay - (today(ads, now).n[kind] || 0));
// one ad watched
export function spend(kind, ads, now = Date.now()) {
  const a = today(ads, now);
  return { ...a, n: { ...a.n, [kind]: (a.n[kind] || 0) + 1 }, total: a.total + 1 };
}

// Overtime: XP doubled while games are left on it
export const boosted = (gain, boost) => ((boost?.games || 0) > 0 ? gain * 2 : gain);
export const useBoost = (boost) => ((boost?.games || 0) > 0 ? { games: boost.games - 1 } : boost || { games: 0 });

// A day's try of an item: trials { id: until }
export const onTrial = (trials, id, now = Date.now()) => (trials?.[id] || 0) > now;
export function startTrial(trials, id, now = Date.now()) {
  const keep = Object.fromEntries(Object.entries(trials || {}).filter(([, t]) => t > now));
  return { ...keep, [id]: now + OFFERS.trial.hours * 3600e3 };
}

// The streak: when one of two days or more breaks, it can be saved that same day.
// lost: { count (the streak that broke), day }
export function brokeStreak(before, after, now = Date.now()) {
  return before && before.count >= 2 && after.count === 1 ? { count: before.count, day: dateKey(now) } : null;
}
export const canRescue = (lost, now = Date.now()) => !!lost && lost.day === dateKey(now);
export const rescue = (st, lost) => ({ ...st, count: lost.count + 1, best: Math.max(st.best || 0, lost.count + 1) });
