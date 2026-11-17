// SOLMARINA — every sound is synthesised with WebAudio. No audio files,
// no network, just oscillators and filtered noise. The engine hum and the
// siren run as loops; the rest are one-shot effects.
export function createAudio() {
  const api = {
    ctx: null, master: null, muted: false,
    engineOsc: null, engineGain: null, engineFilter: null,
    sirenOsc: null, sirenGain: null, sirenTimer: 0, sirenHigh: false,
  };

  function ensure() {
    if (api.ctx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      api.ctx = new Ctx();
      api.master = api.ctx.createGain();
      api.master.gain.value = 0.5;
      api.master.connect(api.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && api.ctx.state === 'suspended') api.ctx.resume();
  }

  function noiseBuffer(seconds) {
    const len = Math.floor(api.ctx.sampleRate * seconds);
    const buf = api.ctx.createBuffer(1, len, api.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure()) return;
    const t = api.ctx.currentTime;
    const osc = api.ctx.createOscillator();
    const gain = api.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(api.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function thud(freq, dur, vol) {
    if (!ensure()) return;
    const t = api.ctx.currentTime;
    const src = api.ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = api.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = freq;
    const gain = api.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(gain); gain.connect(api.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  api.unlock = unlock;
  api.toggleMute = function toggleMute() {
    api.muted = !api.muted;
    if (api.master) api.master.gain.value = api.muted ? 0 : 0.5;
    return api.muted;
  };
  api.isMuted = function isMuted() { return api.muted; };

  api.click = function click() { blip(660, 0.07, 'sine', 0.15); };
  api.pickup = function pickup() { blip(880, 0.1, 'sine', 0.2); setTimeout(() => blip(1318, 0.14, 'sine', 0.2), 90); };
  api.punch = function punch() { thud(300, 0.12, 0.5); };
  api.shot = function shot() { thud(1800, 0.16, 0.55); blip(180, 0.1, 'square', 0.12, 60); };
  api.crash = function crash() { thud(500, 0.3, 0.5); };
  api.win = function win() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110));
  };
  api.fail = function fail() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.12), i * 160));
  };
  api.star = function star() { blip(1046, 0.12, 'sine', 0.18); setTimeout(() => blip(1568, 0.2, 'sine', 0.18), 100); };

  // Engine loop: a sawtooth through a lowpass, pitch following speed.
  api.engine = function engine(speedRatio) {
    if (!ensure()) return;
    if (!api.engineOsc) {
      api.engineOsc = api.ctx.createOscillator();
      api.engineOsc.type = 'sawtooth';
      api.engineFilter = api.ctx.createBiquadFilter();
      api.engineFilter.type = 'lowpass'; api.engineFilter.frequency.value = 900;
      api.engineGain = api.ctx.createGain();
      api.engineGain.gain.value = 0.0;
      api.engineOsc.connect(api.engineFilter);
      api.engineFilter.connect(api.engineGain);
      api.engineGain.connect(api.master);
      api.engineOsc.start();
    }
    const t = api.ctx.currentTime;
    api.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, t, 0.08);
    api.engineGain.gain.setTargetAtTime(speedRatio > 0.02 ? 0.06 + speedRatio * 0.05 : 0.0, t, 0.1);
  };

  // Siren loop: two-tone wail while any cop is close.
  api.siren = function siren(on, dt) {
    if (!ensure()) return;
    if (on && !api.sirenOsc) {
      api.sirenOsc = api.ctx.createOscillator();
      api.sirenOsc.type = 'square';
      api.sirenGain = api.ctx.createGain();
      api.sirenGain.gain.value = 0.035;
      api.sirenOsc.connect(api.sirenGain);
      api.sirenGain.connect(api.master);
      api.sirenOsc.start();
      api.sirenTimer = 0; api.sirenHigh = false;
    }
    if (!on && api.sirenOsc) {
      try { api.sirenOsc.stop(); } catch { /* already stopped */ }
      api.sirenOsc = null; api.sirenGain = null;
      return;
    }
    if (api.sirenOsc) {
      api.sirenTimer += dt;
      if (api.sirenTimer > 0.45) {
        api.sirenTimer = 0; api.sirenHigh = !api.sirenHigh;
        api.sirenOsc.frequency.value = api.sirenHigh ? 960 : 700;
      }
    }
  };

  api.update = function update() { /* loops are driven by engine()/siren() */ };
  return api;
}
