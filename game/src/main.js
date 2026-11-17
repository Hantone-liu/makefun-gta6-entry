// SOLMARINA — boot, the main loop and the screen state machine. The rules
// live in the other modules; this file only wires them together: build the
// world, run the loop, save the game, and stage the screenshots.
import * as THREE from 'three';
import { CITY, MISSIONS, SAVE_KEY, TUNE } from './config.js';
import { mulberry32 } from './random.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { buildCity } from './city.js';
import { spawnTraffic, spawnParked, updateTraffic, drivePlayerCar } from './vehicles.js';
import { spawnPeds, updatePed } from './pedestrians.js';
import { createPolice, createWanted, updatePolice } from './police.js';
import { createPlayer, updatePlayerFoot, enterCar, exitCar, nearestCar } from './player.js';
import { createMissions, startMission, updateMissions, missionObjective } from './missions.js';
import { createHud } from './hud.js';
import { createStage } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 1);
const shotName = params.get('shot');
const testMode = params.get('test') === '1';
const SHOT_MODE = shotName !== null;

window.__solmarina = { version: 'solmarina-1.0', errors: [] };
window.addEventListener('error', (e) => {
  window.__solmarina.errors.push(String(e.message || e.error));
  document.title = `ERROR: ${e.message}`;
  const rep = document.getElementById('test-report');
  if (rep) rep.textContent = JSON.stringify({ errors: window.__solmarina.errors });
});

const rng = mulberry32(seed);
const canvas = document.getElementById('game');
const stage = createStage(canvas);
const city = buildCity(rng);
stage.scene.add(city.group);
const traffic = spawnTraffic(city, rng, 12);
const parked = spawnParked(city, rng);
for (const car of [...traffic, ...parked]) stage.scene.add(car.mesh);
const peds = spawnPeds(city, rng, 16);
for (const ped of peds) stage.scene.add(ped.mesh);
const police = createPolice();
const wanted = createWanted();
const player = createPlayer(city);
stage.scene.add(player.mesh);
// Pickup crates: green for health, amber for ammo.
for (const p of city.pickups) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshLambertMaterial({ color: p.kind === 'health' ? 0x7ac74f : 0xffc93c, emissive: 0x222222 }));
  mesh.position.set(p.x, 0.9, p.z);
  mesh.castShadow = true;
  stage.scene.add(mesh);
  p.mesh = mesh;
}
const missions = createMissions();
const hud = createHud(document);
const audio = createAudio();
const input = createInput(canvas);

const G = {
  rng, stage, scene: stage.scene, city, traffic, parked, peds, police, wanted,
  player, missions, hud, audio, input,
  time: 0, state: 'title', busted: false,
  effects: stage.effects,
  missionObjective,
  playerApi: { enterCar, exitCar },
  save, load,
};

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: player.cash, rep: player.rep, completed: missions.completed,
    }));
  } catch { /* private mode: the save just does not stick */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

hud.bindState(() => G.state);

function applySave(s) {
  if (!s) return;
  player.cash = s.cash || 0;
  player.rep = s.rep || 0;
  missions.completed = s.completed || [false, false, false];
  missions.cashEarned = player.cash;
}

function wireButtons() {
  const on = (id, fn) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); audio.click(); fn(); });
  };
  on('btn-start', () => { applySave(null); hud.hideScreens(); G.state = 'play'; startMission(G, 0); });
  on('btn-continue', () => {
    const s = load();
    applySave(s);
    hud.hideScreens(); G.state = 'play';
    const next = missions.completed.indexOf(false);
    if (next >= 0) startMission(G, next);
  });
  on('btn-freeroam', () => { hud.hideScreens(); G.state = 'play'; });
  on('btn-help', () => hud.showOnly('help'));
  on('btn-help-back', () => hud.showTitle(!!load()));
  on('btn-brief-go', () => hud.hideScreens());
  on('btn-next', () => {
    hud.hideScreens(); G.state = 'play';
    const next = missions.completed.indexOf(false);
    if (next >= 0) startMission(G, next);
    else { G.missions.index = -1; }
  });
  on('btn-complete-roam', () => { hud.hideScreens(); G.state = 'play'; missions.index = -1; missions.state = 'idle'; });
  on('btn-retry', () => {
    hud.hideScreens(); G.state = 'play';
    G.busted = false; player.health = 100;
    const idx = missions.index >= 0 ? missions.index : 0;
    startMission(G, idx);
  });
  on('btn-failed-title', () => { G.busted = false; G.state = 'title'; hud.showTitle(!!load()); });
  on('btn-results-again', () => {
    hud.hideScreens(); G.state = 'play';
    missions.completed = [false, false, false];
    player.cash = 0; player.rep = 0;
    startMission(G, 0);
  });
  on('btn-results-roam', () => { hud.hideScreens(); G.state = 'play'; missions.index = -1; missions.state = 'idle'; });
  on('btn-resume', () => { hud.hideScreens(); G.state = 'play'; });
  on('btn-restart-mission', () => {
    hud.hideScreens(); G.state = 'play';
    if (missions.index >= 0) startMission(G, missions.index);
  });
  on('btn-quit-title', () => { G.state = 'title'; hud.showTitle(!!load()); });
}

function resize() {
  stage.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

function update(dt) {
  G.time += dt;
  // Pause and menus freeze the world but keep rendering.
  if (G.state === 'pause') return;
  const ax = input.axis();
  if (player.inCar && player.car) {
    const crashed = drivePlayerCar(player.car, ax, !!input.keys[' '], dt, city);
    if (crashed) { audio.crash(); stage.effects.sparks(player.car.x, 1, player.car.z); player.shake = 0.4; }
    audio.engine(Math.abs(player.car.speed) / 30);
    if (Math.random() < dt * 6) stage.effects.exhaust(player.car.x, 0.6, player.car.z, player.car.heading);
    player.x = player.car.x; player.z = player.car.z;
    player.heading = player.car.heading;
    if (input.pressed('e')) exitCar(G);
  } else {
    updatePlayerFoot(G, dt);
    audio.engine(0);
    const near = nearestCar([...traffic, ...parked], player.x, player.z, 4.5);
    if (near && input.pressed('e')) enterCar(G, near);
  }
  for (const car of traffic) updateTraffic(car, city, [...traffic, ...police.cars], dt, rng);
  for (const ped of peds) updatePed(ped, city, player, dt, rng);
  updatePolice(police, G, dt, rng);
  updateMissions(G, dt);
  if (G.busted && missions.state !== 'active') {
    G.busted = false;
    player.health = 100;
    hud.showFailed('Busted by the Solmarina PD.');
  }
  if (player.health <= 0 && missions.state !== 'active') {
    player.health = 100;
    player.x = -216; player.z = -216;
    hud.toast('Wasted — you wake up at the hideout.');
  }
  // All missions done: the results screen.
  if (missions.completed.every(Boolean) && missions.state === 'done' && G.state === 'play') {
    missions.state = 'idle';
    hud.showResults(player.cash, player.rep);
  }
  audio.siren(police.sirenOn, dt);
  stage.updateParticles(dt);
  stage.updateCamera(G, dt);
  hud.update(G);
  // Pause key.
  if (input.keys['Escape'] && G.state === 'play') {
    input.keys['Escape'] = false;
    G.state = 'pause';
    hud.showOnly('pause');
  }
  if (input.keys['m'] || input.keys.M) {
    input.keys['m'] = false; input.keys.M = false;
    audio.toggleMute();
    hud.toast(audio.isMuted() ? 'Sound off' : 'Sound on');
  }
}

wireButtons();
hud.showTitle(!!load());
G.state = 'title';

// Title camera: slow orbit over the plaza while the menu is up.
let titleAngle = 0;

if (SHOT_MODE) {
  stageShot(shotName, G);
} else if (testMode) {
  // Headless self-test: run 20 s of play synchronously (no timers, so a
  // headless run finishes in one go), then report into #test-report.
  hud.hideScreens();
  G.state = 'play';
  startMission(G, 0);
  const steps = Math.round(20 / (1 / 60));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  stage.renderer.render(stage.scene, stage.camera);
  const report = {
    errors: window.__solmarina.errors,
    player: { x: Math.round(player.x), z: Math.round(player.z), health: Math.round(player.health) },
    wanted: wanted.stars,
    traffic: traffic.length, peds: peds.length,
    mission: missions.state, fps: 'n/a',
  };
  const rep = document.getElementById('test-report');
  if (rep) rep.textContent = JSON.stringify(report);
  document.title = 'TEST-DONE';
  window.__solmarina.testReport = report;
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.state === 'title') {
      titleAngle += dt * 0.05;
      stage.camera.position.set(Math.sin(titleAngle) * 120, 55, Math.cos(titleAngle) * 120);
      stage.camera.lookAt(0, 0, 0);
      stage.updateParticles(dt);
      for (const car of traffic) updateTraffic(car, city, traffic, dt, rng);
      for (const ped of peds) updatePed(ped, city, player, dt, rng);
    } else {
      update(dt);
    }
    stage.renderer.render(stage.scene, stage.camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.__solmarina.game = G;
