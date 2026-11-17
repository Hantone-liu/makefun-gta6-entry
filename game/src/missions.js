// SOLMARINA — the story. Three missions, one arc: a courier who needs cash
// takes a delivery, steals a car, then runs a five-star escape across the
// city. Each mission is steps with a target, a timer and a reward; finishing
// one pays cash, raises rep, and unlocks the next. Free roam is always there.
import { MISSIONS } from './config.js';
import { makeBeacon } from './city.js';

export function createMissions() {
  return {
    index: -1, // -1: no mission (free roam / title)
    step: 0, timeLeft: 0, state: 'idle', // idle | active | done | failed
    beacon: null, completed: [false, false, false],
    cashEarned: 0,
  };
}

export function startMission(G, index) {
  const m = G.missions;
  const def = MISSIONS[index];
  m.index = index;
  m.step = 0;
  m.timeLeft = def.timeLimit;
  m.state = 'active';
  G.player.health = 100;
  if (G.player.inCar) {
    // Missions start on foot at the hideout, except the escape.
    const { exitCar } = G.playerApi;
    exitCar(G);
  }
  if (index === 2) {
    // Harbor Run: the heat is already on.
    G.wanted.add(5, G.time);
    G.player.x = 0; G.player.z = 0;
  } else {
    G.player.x = -216; G.player.z = -216;
    G.player.mesh.position.set(G.player.x, 0, G.player.z);
  }
  G.player.mesh.visible = true;
  setBeacon(G);
  G.hud.showBrief(def);
  G.hud.toast(`Mission: ${def.title}`);
  G.audio.star();
}

function setBeacon(G) {
  const m = G.missions;
  if (m.beacon) { G.scene.remove(m.beacon); m.beacon = null; }
  if (m.state !== 'active') return;
  const step = MISSIONS[m.index].steps[m.step];
  if (!step || !step.target) return;
  const beacon = makeBeacon(step.steal ? 0xffd21f : 0xff5a3c);
  beacon.position.set(step.target.x, 0, step.target.z);
  G.scene.add(beacon);
  m.beacon = beacon;
}

export function updateMissions(G, dt) {
  const m = G.missions;
  if (m.state !== 'active') return;
  const def = MISSIONS[m.index];
  const step = def.steps[m.step];
  m.timeLeft -= dt;
  if (m.timeLeft <= 0) {
    failMission(G, 'Out of time.');
    return;
  }
  if (G.busted) { failMission(G, 'Busted by the Solmarina PD.'); return; }
  if (G.player.health <= 0) { failMission(G, 'Wasted.'); return; }
  if (!step) return;
  if (step.loseCops) {
    if (G.wanted.stars === 0) advanceStep(G);
    return;
  }
  if (step.steal) {
    // Done when the player is driving the marked Comet.
    if (G.player.inCar && G.player.car && G.player.car.marked) advanceStep(G);
    return;
  }
  const d = Math.hypot(step.target.x - G.player.x, step.target.z - G.player.z);
  if (d < step.radius) {
    if (m.index === 0 && m.step === 0) {
      G.hud.toast('Package picked up. Deliver it to the Palms Hotel.');
      G.audio.pickup();
    }
    advanceStep(G);
  }
}

function advanceStep(G) {
  const m = G.missions;
  const def = MISSIONS[m.index];
  m.step += 1;
  if (m.step >= def.steps.length) {
    completeMission(G);
    return;
  }
  setBeacon(G);
  G.audio.pickup();
}

function completeMission(G) {
  const m = G.missions;
  const def = MISSIONS[m.index];
  m.state = 'done';
  m.completed[m.index] = true;
  m.cashEarned += def.reward;
  G.player.cash += def.reward;
  G.player.rep += def.rep;
  if (m.beacon) { G.scene.remove(m.beacon); m.beacon = null; }
  G.wanted.stars = Math.max(0, G.wanted.stars - 2);
  G.audio.win();
  G.effects.confetti(G.player);
  G.save();
  if (m.index === 0) {
    G.hud.toast('Delivery done! +$150. A pistol pickup is stashed at the hideout.');
  }
  G.hud.showComplete(def, m.index);
}

function failMission(G, reason) {
  const m = G.missions;
  m.state = 'failed';
  if (m.beacon) { G.scene.remove(m.beacon); m.beacon = null; }
  G.audio.fail();
  G.hud.showFailed(reason, m.index);
}

export function missionObjective(G) {
  const m = G.missions;
  if (m.state !== 'active') return null;
  const def = MISSIONS[m.index];
  const step = def.steps[m.step];
  if (!step) return null;
  const d = step.target
    ? Math.round(Math.hypot(step.target.x - G.player.x, step.target.z - G.player.z))
    : null;
  return { title: def.title, text: step.text, timeLeft: Math.ceil(m.timeLeft), dist: d };
}
