// SOLMARINA — the HUD: DOM panels over the 3D view, a live minimap, toasts,
// and every menu screen. Glass panels, one coral accent, big numbers —
// built to stay readable when the screenshot shrinks to a small cell.
import { CITY, MISSIONS, PALETTE } from './config.js';
import { clamp } from './random.js';

export function createHud(doc) {
  const $ = (id) => doc.getElementById(id);
  const hud = {
    el: $('hud'),
    healthFill: $('health-fill'), healthText: $('health-text'),
    cashText: $('cash-text'), repText: $('rep-text'),
    starsEl: $('wanted-stars'), objectiveEl: $('objective'),
    speedText: $('speed-text'), ammoText: $('ammo-text'), hintText: $('hint-text'),
    minimap: $('minimap'), toastsEl: $('toasts'), crosshair: $('crosshair'),
    screens: {
      title: $('screen-title'), brief: $('screen-brief'),
      complete: $('screen-complete'), failed: $('screen-failed'),
      results: $('screen-results'), pause: $('screen-pause'), help: $('screen-help'),
    },
    toastQueue: [],
  };

  hud.showOnly = function showOnly(name) {
    for (const [key, el] of Object.entries(hud.screens)) {
      if (el) el.classList.toggle('hidden', key !== name);
    }
    if (hud.el) hud.el.classList.toggle('hidden', !!name && name !== 'pause');
  };
  hud.hideScreens = function hideScreens() {
    for (const el of Object.values(hud.screens)) if (el) el.classList.add('hidden');
    if (hud.el) hud.el.classList.remove('hidden');
  };
  hud.toast = function toast(msg) {
    if (!hud.toastsEl) return;
    const div = doc.createElement('div');
    div.className = 'toast';
    div.textContent = msg;
    hud.toastsEl.appendChild(div);
    while (hud.toastsEl.children.length > 3) hud.toastsEl.removeChild(hud.toastsEl.firstChild);
    setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 4200);
  };
  hud.showBrief = function showBrief(def) {
    const el = hud.screens.brief;
    if (!el) return;
    $('brief-title').textContent = def.title;
    $('brief-text').textContent = def.brief;
    $('brief-reward').textContent = `Reward $${def.reward}  •  Rep +${def.rep}  •  ${def.timeLimit}s`;
    hud.showOnly('brief');
    setTimeout(() => { if (G_state() === 'play') hud.hideScreens(); }, 5000);
  };
  hud.showComplete = function showComplete(def, index) {
    const el = hud.screens.complete;
    if (!el) return;
    $('complete-title').textContent = 'MISSION COMPLETE';
    $('complete-name').textContent = def.title;
    $('complete-cash').textContent = `+$${def.reward}`;
    const next = index + 1 < MISSIONS.length ? MISSIONS[index + 1].title : null;
    $('complete-next').textContent = next ? `Next: ${next}` : 'All missions complete — Solmarina is yours.';
    hud.showOnly('complete');
  };
  hud.showFailed = function showFailed(reason, index) {
    const el = hud.screens.failed;
    if (!el) return;
    $('failed-reason').textContent = reason;
    $('failed-name').textContent = MISSIONS[index] ? MISSIONS[index].title : 'Free roam';
    hud.showOnly('failed');
  };
  hud.showResults = function showResults(cash, rep) {
    const el = hud.screens.results;
    if (!el) return;
    $('results-cash').textContent = `$${cash}`;
    $('results-rep').textContent = `${rep} rep`;
    hud.showOnly('results');
  };
  hud.showTitle = function showTitle(hasSave) {
    hud.showOnly('title');
    const cont = $('btn-continue');
    if (cont) cont.classList.toggle('hidden', !hasSave);
  };

  function G_state() { return hud._state ? hud._state() : 'play'; }
  hud.bindState = function bindState(fn) { hud._state = fn; };

  hud.update = function update(G) {
    const p = G.player;
    if (hud.healthFill) {
      hud.healthFill.style.width = `${clamp(p.health, 0, 100)}%`;
      hud.healthFill.style.background = p.health > 50 ? '#7ac74f' : p.health > 25 ? '#ffc93c' : '#ff5a3c';
    }
    if (hud.healthText) hud.healthText.textContent = `${Math.max(0, Math.ceil(p.health))}`;
    if (hud.cashText) hud.cashText.textContent = `$${p.cash}`;
    if (hud.repText) hud.repText.textContent = `★ ${p.rep}`;
    if (hud.starsEl) {
      let s = '';
      for (let i = 0; i < 5; i += 1) s += i < G.wanted.stars ? '★' : '☆';
      hud.starsEl.textContent = s;
      hud.starsEl.classList.toggle('hot', G.wanted.stars >= 3);
    }
    if (hud.objectiveEl) {
      const obj = G.missionObjective ? G.missionObjective(G) : null;
      if (obj) {
        hud.objectiveEl.innerHTML = `<b>${obj.title}</b> — ${obj.text}` +
          (obj.dist !== null ? ` <span class="dist">${obj.dist}m</span>` : '') +
          ` <span class="timer">${obj.timeLeft}s</span>`;
      } else if (G.missions.index >= 0 && G.missions.state === 'done') {
        hud.objectiveEl.textContent = 'Mission complete — pick the next job from the pause menu.';
      } else {
        hud.objectiveEl.textContent = 'Free roam — explore Solmarina. Press Esc for missions.';
      }
    }
    if (hud.speedText) {
      hud.speedText.textContent = p.inCar && p.car ? `${Math.round(Math.abs(p.car.speed) * 3.6)} km/h` : '';
    }
    if (hud.ammoText) {
      hud.ammoText.textContent = p.armed ? `🔫 ${p.ammo}` : '';
    }
    if (hud.hintText) {
      if (p.inCar) hud.hintText.textContent = 'W/S drive • A/D steer • Space handbrake • E get out';
      else hud.hintText.textContent = 'WASD move • Shift sprint • E enter car • F punch • Click shoot • M mute';
    }
    if (hud.crosshair) hud.crosshair.classList.toggle('hidden', !(p.armed && !p.inCar));
    drawMinimap(G);
  };

  function drawMinimap(G) {
    const cv = hud.minimap;
    if (!cv) return;
    const g = cv.getContext('2d');
    const S = cv.width;
    const toMap = (v) => ((v + 320) / 640) * S;
    g.clearRect(0, 0, S, S);
    // Sea + sand + city base.
    g.fillStyle = '#2e7f9e'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#e8cf9a'; g.fillRect(0, toMap(250), S, S - toMap(250));
    g.fillStyle = '#3a3f4a'; g.fillRect(0, 0, S, toMap(250));
    g.fillStyle = '#8f9a6b';
    for (let bz = 0; bz < CITY.blocks; bz += 1) {
      for (let bx = 0; bx < CITY.blocks; bx += 1) {
        g.fillRect(toMap(-236 + bx * CITY.pitch), toMap(-236 + bz * CITY.pitch), 13, 13);
      }
    }
    // Streets.
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
    for (const s of CITY.streetLines) {
      g.beginPath(); g.moveTo(0, toMap(s)); g.lineTo(S, toMap(s)); g.stroke();
      g.beginPath(); g.moveTo(toMap(s), 0); g.lineTo(toMap(s), S); g.stroke();
    }
    const dot = (x, z, color, r) => {
      g.fillStyle = color;
      g.beginPath(); g.arc(toMap(x), toMap(z), r, 0, Math.PI * 2); g.fill();
    };
    // Mission target: pulsing coral ring.
    const obj = G.missionObjective ? G.missionObjective(G) : null;
    if (obj) {
      const def = MISSIONS[G.missions.index];
      const step = def.steps[G.missions.step];
      if (step && step.target) {
        const pulse = 6 + Math.sin(G.time * 4) * 2;
        g.strokeStyle = PALETTE.accent; g.lineWidth = 2.5;
        g.beginPath(); g.arc(toMap(step.target.x), toMap(step.target.z), pulse, 0, Math.PI * 2); g.stroke();
        dot(step.target.x, step.target.z, PALETTE.accent, 3);
      }
    }
    for (const c of G.traffic) dot(c.x, c.z, '#ffffff', 2);
    for (const c of G.police.cars) dot(c.x, c.z, '#2a5ad8', 3.5);
    for (const p of G.peds) dot(p.x, p.z, '#ffd98a', 1.6);
    for (const pk of G.city.pickups) if (!pk.taken) dot(pk.x, pk.z, '#7ac74f', 2.5);
    // Player arrow.
    const px = toMap(G.player.x); const pz = toMap(G.player.z);
    g.save();
    g.translate(px, pz);
    g.rotate(Math.PI - G.player.heading);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.strokeStyle = '#ff5a3c'; g.lineWidth = 2; g.stroke();
    g.restore();
    // Border.
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
    g.strokeRect(1, 1, S - 2, S - 2);
  }
  return hud;
}
