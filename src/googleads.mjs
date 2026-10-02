// Google's rewarded ads for HTML5 games (AdSense's Ad Placement API: adConfig and adBreak). The game
// asks for a rewarded break ahead of time, and Google answers through beforeReward only when it has an
// ad ready, so the game shows its offers only then. Until AdSense approves the site no ad comes, so
// nothing shows; after that, offers appear on their own. ?adtest=1 asks for Google's test ads.
const CLIENT = 'ca-pub-5860144532070180';

// onChange(ready): an ad became ready or was used up; mute(on): the game's sound around an ad
export function createGoogleAds({ test = false, onChange = () => {}, mute = () => {} } = {}) {
  window.adsbygoogle = window.adsbygoogle || [];
  const push = (o) => window.adsbygoogle.push(o); // adConfig and adBreak both go through push
  const s = document.createElement('script');
  s.async = true; s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
  if (test) s.setAttribute('data-adbreak-test', 'on');
  document.head.appendChild(s);
  push({ preloadAdBreaks: 'on', sound: 'on' });

  let showFn = null, pending = null, wait = 4e3, timer = 0;
  const settle = (ok) => { const p = pending; pending = null; if (p) p(ok); };
  // ask for the next rewarded ad; with none to give (or none loaded yet), ask again soon, then less often
  function ask() {
    clearTimeout(timer);
    let offered = false;
    push({
      type: 'reward', name: 'gantimpala',
      beforeAd: () => mute(true), afterAd: () => mute(false),
      beforeReward: (fn) => { offered = true; showFn = fn; wait = 4e3; onChange(true); },
      adViewed: () => settle(true),
      adDismissed: () => settle(false),
      adBreakDone: () => {
        showFn = null; settle(false); onChange(false);
        timer = setTimeout(ask, offered ? 1500 : wait);
        if (!offered) wait = Math.min(wait * 2, 10 * 60e3);
      },
    });
  }
  ask();
  return {
    ready: () => !!showFn,
    // called from the player's click: plays the ad, true if it was watched to the end
    show: () => new Promise((resolve) => { if (!showFn) { resolve(false); return; } pending = resolve; const fn = showFn; showFn = null; fn(); }),
  };
}
