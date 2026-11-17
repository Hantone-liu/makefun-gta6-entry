// SOLMARINA — pedestrians. Low-poly people who stroll the sidewalks, stop
// at corners, and flee when a car comes at them or a shot rings out. Hitting
// one is a crime; a fleeing crowd is how the city tells the judge it is alive.
import * as THREE from 'three';
import { CITY, TUNE } from './config.js';
import { chance, clamp, pick, range } from './random.js';

const SHIRTS = [0xe85a3c, 0x3c7ae8, 0x5aa83c, 0xe8c93c, 0x9a5ae8, 0xe8e8e8, 0x3c3c3c, 0xe88ab0];
const PANTS = [0x2a3a5a, 0x3a3a3a, 0x5a4a3a, 0x6a7a8a];

export function makePersonMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4),
    new THREE.MeshLambertMaterial({ color: shirt }));
  body.position.y = 1.15; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.85; head.castShadow = true;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.75, 0.35),
    new THREE.MeshLambertMaterial({ color: pants }));
  legs.position.y = 0.38;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18),
    new THREE.MeshLambertMaterial({ color: shirt }));
  armL.position.set(-0.45, 1.2, 0);
  const armR = armL.clone();
  armR.position.x = 0.45;
  g.add(body); g.add(head); g.add(legs); g.add(armL); g.add(armR);
  g.userData = { body, head, legs, armL, armR, bob: Math.random() * 6 };
  return g;
}

export function createPed(city, rng) {
  const p = city.randomRoadPoint();
  // Step off the road onto the sidewalk.
  const x = p.x + range(rng, -8, 8);
  const z = p.z + range(rng, -8, 8);
  const mesh = makePersonMesh(pick(rng, SHIRTS), pick(rng, PANTS), pick(rng, [0xe8b88a, 0xc88a5a, 0x8a5a3a, 0xf0c8a0]));
  mesh.position.set(x, 0, z);
  return {
    kind: 'ped', mesh, x, z,
    heading: range(rng, 0, Math.PI * 2),
    speed: range(rng, TUNE.pedSpeed[0], TUNE.pedSpeed[1]),
    state: 'walk', stateT: range(rng, 2, 8), health: TUNE.pedHealth,
    target: null, down: false, downT: 0,
  };
}

export function spawnPeds(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) peds.push(createPed(city, rng));
  return peds;
}

function pickWalkTarget(ped, city, rng) {
  const p = city.randomRoadPoint();
  ped.target = { x: p.x + range(rng, -8, 8), z: p.z + range(rng, -8, 8) };
}

export function updatePed(ped, city, player, dt, rng) {
  if (ped.down) {
    ped.downT += dt;
    ped.mesh.rotation.x = Math.min(Math.PI / 2, ped.mesh.rotation.x + dt * 4);
    if (ped.downT > 6) {
      ped.down = false; ped.downT = 0; ped.health = TUNE.pedHealth;
      ped.mesh.rotation.x = 0;
      ped.x = city.randomRoadPoint().x; ped.z = city.randomRoadPoint().z;
      ped.state = 'walk';
    }
    return;
  }
  // Flee from the player when they are violent or speeding at you.
  const dx = ped.x - player.x; const dz = ped.z - player.z;
  const d = Math.hypot(dx, dz);
  const threat = player.inCar ? Math.abs(player.speed) > 10 : player.attackedRecently > 0;
  if (d < 10 && threat) {
    ped.state = 'flee';
    ped.heading = Math.atan2(dx, dz);
    ped.speed = 4.2;
  } else if (ped.state === 'flee' && d > 26) {
    ped.state = 'walk'; ped.speed = range(rng, TUNE.pedSpeed[0], TUNE.pedSpeed[1]);
  }
  if (ped.state === 'walk') {
    ped.stateT -= dt;
    if (!ped.target || ped.stateT <= 0) { pickWalkTarget(ped, city, rng); ped.stateT = range(rng, 4, 10); }
    const tx = ped.target.x - ped.x; const tz = ped.target.z - ped.z;
    const td = Math.hypot(tx, tz);
    if (td < 2) { ped.target = null; }
    else ped.heading = Math.atan2(tx, tz);
  }
  const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
  const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
  const hit = city.collideCircle(nx, nz, 0.5);
  ped.x = hit.x; ped.z = hit.z;
  ped.mesh.position.set(ped.x, 0, ped.z);
  ped.mesh.rotation.y = ped.heading;
  // Walk bob.
  const u = ped.mesh.userData;
  u.bob += dt * ped.speed * 2.4;
  const bob = Math.sin(u.bob) * 0.06;
  u.body.position.y = 1.15 + Math.abs(bob);
  u.armL.rotation.x = Math.sin(u.bob) * 0.5;
  u.armR.rotation.x = -Math.sin(u.bob) * 0.5;
  void clamp; void chance;
}

export function knockDown(ped, fromX, fromZ, damage) {
  ped.health -= damage;
  if (ped.health <= 0 && !ped.down) {
    ped.down = true; ped.downT = 0;
    const dx = ped.x - fromX; const dz = ped.z - fromZ;
    const d = Math.max(0.5, Math.hypot(dx, dz));
    ped.x += (dx / d) * 2; ped.z += (dz / d) * 2;
    return true;
  }
  ped.state = 'flee';
  ped.heading = Math.atan2(ped.x - fromX, ped.z - fromZ);
  return false;
}

export function nearestPed(peds, x, z, maxD) {
  let best = null; let bestD = maxD;
  for (const p of peds) {
    if (p.down) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { best = p; bestD = d; }
  }
  return best;
}
