// Kapatas's voice: a slot per moment. A recording at assets/voice/<slot>.mp3 plays if it is there;
// otherwise the browser speaks the line with a Filipino voice (fil-PH or tl) if it has one; otherwise a
// short vocal-like babble from the synthesizer goes with the speech bubble.
export const VOICE_SLOTS = ['bayanihan', 'tspin', 'rankup', 'neardeath', 'win', 'lose'];
export const VOICE_LINES = {
  bayanihan: 'Bayanihan! Ang galing!', tspin: 'T-spin! Pang-engineer!', rankup: 'Bagong ranggo! Ipagpatuloy mo!',
  neardeath: 'Ingat! Guguho na!', win: 'Tapos ang trabaho! Galing!', lose: 'Gumuho! Bukas ulit tayo.',
};
// a Filipino voice, if the browser has one
export function pickVoice(voices = [], lang = 'fil') {
  const by = (re) => voices.find((v) => re.test(v.lang || ''));
  if (lang === 'en') return by(/^en(-|_)?(PH|US|GB|AU)$/i) || by(/^en/i) || null; // in English, an English voice
  return by(/^fil(-|_)?PH$/i) || by(/^fil/i) || by(/^tl(-|_)?PH$/i) || by(/^tl/i) || null;
}
// which way a slot will sound: 'file', 'speech' or 'blip'
export function plan(slot, { files = new Set(), voice = null } = {}) {
  if (files.has(slot)) return 'file';
  if (voice) return 'speech';
  return 'blip';
}

// A: the audio engine (for the file and the babble); base: where the recordings are; lang and tr: the
// language to speak, and its lines.
export function createVoice(A, { base = 'assets/voice/', lang = 'fil', tr = (s) => s } = {}) {
  const files = new Set();
  let voice = null, on = true, vol = 0.8, last = 0;
  // which recordings exist (a HEAD each, once)
  if (lang === 'fil') for (const s of VOICE_SLOTS) fetch(`${base}${s}.mp3`, { method: 'HEAD' }).then((r) => { if (r.ok && /audio|mpeg|octet/.test(r.headers.get('content-type') || 'audio')) files.add(s); }).catch(() => { /* none */ });
  const findVoice = () => { try { voice = pickVoice(window.speechSynthesis ? speechSynthesis.getVoices() : [], lang); } catch { voice = null; } };
  findVoice();
  try { if (window.speechSynthesis) speechSynthesis.addEventListener('voiceschanged', findVoice); } catch { /* no speech */ }
  return {
    VOICE_SLOTS,
    get files() { return files; },
    setOn(b) { on = b; }, setVolume(v) { vol = v; },
    // say a slot's line (text: what the bubble shows, spoken if there's no recording)
    say(slot, text = tr(VOICE_LINES[slot])) {
      if (!on || vol <= 0) return null;
      const now = performance.now(); if (now - last < 1200) return null; last = now;
      const how = plan(slot, { files, voice });
      if (how === 'file') A.voiceFile(`${base}${slot}.mp3`, vol);
      else if (how === 'speech') { try { const u = new SpeechSynthesisUtterance(text); u.voice = voice; u.lang = voice.lang; u.rate = 1.05; u.pitch = 0.85; u.volume = vol; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch { A.blip(text, vol); } }
      else A.blip(text, vol);
      return how;
    },
  };
}
