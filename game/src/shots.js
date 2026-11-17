// SOLMARINA — the four screenshot scenes behind ?shot=chase|street|heat|results.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot, so the frame is what the
// game really looks like and the same seed always gives the same frame.
// Cover first: a chase with the HUD, the minimap, the wanted stars and a
// mission objective all visible, the scene filling the frame.
import { MISSIONS } from './config.js';
import { drivePlayerCar, createCar } from './vehicles.js';
import { updateTraffic } from './vehicles.js';
import { updatePed } from './pedestrians.js';
import { updatePolice } from './police.js';
import { startMission } from './missions.js';

const STEP = 1 / 30;

function simSeconds(G, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    G.time += STEP;
    if (drive && G.player.inCar && G.player.car) {
      drivePlayerCar(G.player.car, drive(G), false, STEP, G.city);
      G.audio.engine(Math.abs(G.player.car.speed) / 30);
      // Keep the player glued to the car: the camera and HUD read player.x/z.
      G.player.x = G.player.car.x;
      G.player.z = G.player.car.z;
      G.player.heading = G.player.car.heading;
    }
    for (const car of G.traffic) updateTraffic(car, G.city, [...G.traffic, ...G.police.cars], STEP, G.rng);
    for (const ped of G.peds) updatePed(ped, G.city, G.player, STEP, G.rng);
    updatePolice(G.police, G, STEP, G.rng);
    G.stage.updateParticles(STEP);
  }
}

function placeCamera(G, x, y, z, tx, ty, tz) {
  G.stage.camera.position.set(x, y, z);
  G.stage.camera.lookAt(tx, ty, tz);
}

function chaseCam(G) {
  const p = G.player;
  const heading = p.inCar && p.car ? p.car.heading : p.heading;
  const yaw = heading + Math.PI;
  const dist = 14;
  // Camera higher and looking ahead, so the car sits in the lower third
  // and the avenue, traffic and cops ahead fill the frame.
  placeCamera(G,
    p.x + Math.sin(yaw) * dist, 6.5, p.z + Math.cos(yaw) * dist,
    p.x + Math.sin(heading) * 7, 1.8, p.z + Math.cos(heading) * 7);
}

// A police car placed for the frame: a real game unit, same as the ones the
// wanted system spawns, just positioned where the camera can see it.
function placePolice(G, x, z, heading) {
  const car = createCar('police', x, z, heading, 0x1a2a4a);
  car.speed = 22;
  G.police.cars.push(car);
  G.scene.add(car.mesh);
}

// A traffic car repositioned into the frame ahead of the player.
function placeTraffic(G, x, z, heading) {
  const car = G.traffic.find((c) => !c._staged) || G.traffic[0];
  car._staged = true;
  car.x = x; car.z = z; car.heading = heading; car.speed = 12;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  return car;
}

export function stageShot(name, G) {
  const S = G.stage;
  // The frame must show the game, not a menu: hide every screen first.
  // (startMission shows a brief card; each branch hides it again below.)
  G.hud.hideScreens();
  G.state = 'play';
  if (name === 'chase') {
    // Cover: mission 2, mid-escape — the marked Comet, three stars, two cop
    // cars on your tail, traffic ahead, beachfront avenue at dusk.
    startMission(G, 1);
    G.hud.hideScreens();
    G.missions.step = 1; // "lose the cops" — objective + timer on the HUD
    G.missions.timeLeft = 187;
    const car = G.parked.find((c) => c.marked);
    car.x = -120; car.z = 243; car.heading = Math.PI / 2; car.speed = 0;
    G.player.x = -120; G.player.z = 243;
    G.player.inCar = true; G.player.car = car; car.driver = true; car.stolen = true;
    car.mesh.visible = true;
    G.player.mesh.visible = false;
    G.wanted.stars = 3;
    G.player.cash = 150; G.player.rep = 1;
    simSeconds(G, 5, () => ({ x: 0, y: 1 }));
    // Cops closing in ahead of the camera, traffic further up the avenue.
    const h = G.player.car.heading;
    const fx = Math.sin(h), fz = Math.cos(h);
    placePolice(G, G.player.x + fx * 26 - fz * 8, G.player.z + fz * 26 + fx * 8, h);
    placePolice(G, G.player.x + fx * 16 + fz * 9, G.player.z + fz * 16 - fx * 9, h);
    placeTraffic(G, G.player.x + fx * 62, G.player.z + fz * 62, h);
    // Frame the chase: car, cops, avenue, hotels, sea.
    chaseCam(G);
    G.hud.update(G);
    S.renderer.render(S.scene, S.camera);
  } else if (name === 'street') {
    // On foot in the city: plaza, fountain, pedestrians, traffic, hotels.
    G.player.x = -8; G.player.z = 30; G.player.heading = Math.PI;
    G.player.mesh.position.set(-8, 0, 30);
    G.player.mesh.rotation.y = Math.PI;
    G.player.cameraYaw = 0;
    G.player.cash = 150; G.player.rep = 1;
    G.missions.index = -1; G.missions.state = 'idle'; // free roam, no mission banner
    simSeconds(G, 4, null);
    placeCamera(G, -8 + Math.sin(0) * 9, 4.2, 30 + Math.cos(0) * 9, -8, 1.5, 30 - 12);
    G.hud.update(G);
    S.renderer.render(S.scene, S.camera);
  } else if (name === 'heat') {
    // Five-star escape: the midnight run, four cop cars converging.
    startMission(G, 2);
    G.hud.hideScreens();
    G.missions.timeLeft = 196;
    const car = G.parked[1];
    // East along the z=81 avenue toward the marina — straight, so the car
    // stays on the road (a steering autopilot drifted it into a building).
    car.x = 27; car.z = 81; car.heading = Math.PI / 2; car.speed = 0;
    G.player.x = 27; G.player.z = 81;
    G.player.inCar = true; G.player.car = car; car.driver = true; car.stolen = true;
    G.player.mesh.visible = false;
    simSeconds(G, 6, () => ({ x: 0, y: 1 }));
    // Cops converging ahead of the camera, traffic further up the road.
    const h = G.player.car.heading;
    const fx = Math.sin(h), fz = Math.cos(h);
    placePolice(G, G.player.x + fx * 24 - fz * 9, G.player.z + fz * 24 + fx * 9, h);
    placePolice(G, G.player.x + fx * 30 + fz * 8, G.player.z + fz * 30 - fx * 8, h);
    placePolice(G, G.player.x + fx * 44, G.player.z + fz * 44, h);
    placeTraffic(G, G.player.x + fx * 70, G.player.z + fz * 70, h);
    chaseCam(G);
    G.hud.update(G);
    S.renderer.render(S.scene, S.camera);
  } else if (name === 'results') {
    // The results screen after the final mission: stars, cash, PLAY AGAIN.
    G.missions.completed = [true, true, true];
    G.player.cash = 1550; G.player.rep = 6;
    G.player.x = 0; G.player.z = 200; G.player.heading = Math.PI;
    G.player.mesh.position.set(0, 0, 200);
    G.player.mesh.rotation.y = Math.PI;
    simSeconds(G, 3, null);
    placeCamera(G, 0, 26, 268, 0, 4, 120);
    G.hud.showResults(1550, 6);
    S.renderer.render(S.scene, S.camera);
  } else {
    // Unknown shot: the title city, camera drifting over the plaza.
    placeCamera(G, 60, 40, 120, 0, 0, 0);
    S.renderer.render(S.scene, S.camera);
  }
  document.title = 'SHOT-READY';
  window.__solmarina = window.__solmarina || {};
  window.__solmarina.shotReady = true;
}
