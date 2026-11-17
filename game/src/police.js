// SOLMARINA — the wanted system and the police. Stars rise on crime and
// fall when the player stays quiet and out of sight. Police cars spawn at
// the map edge and chase on the streets; foot cops chase on foot and try to
// grab the player. Busted or wasted ends the mission.
import * as THREE from 'three';
import { CITY, PALETTE, TUNE } from './config.js';
import { clamp, pick, range } from './random.js';
import { createCar } from './vehicles.js';
import { makePersonMesh } from './pedestrians.js';

export function createWanted() {
  return {
    stars: 0, quietT: 0, lastCrimeT: -999,
    add(n, now) {
      this.stars = clamp(this.stars + n, 0, 5);
      this.lastCrimeT = now;
      this.quietT = 0;
    },
    update(now, dt, nearestCopDist) {
      if (this.stars === 0) return;
      if (nearestCopDist > 55 && now - this.lastCrimeT > TUNE.wantedDecayIdle) {
        this.quietT += dt;
        if (this.quietT > 6) {
          this.stars -= 1;
          this.quietT = 0;
          this.lastCrimeT = now;
        }
      } else {
        this.quietT = 0;
      }
    },
  };
}

function spawnCopCar(city, rng, player) {
  // Spawn on a street at the edge, away from the player.
  const edge = pick(rng, CITY.streetLines);
  const spots = [
    { x: edge, z: player.z > 0 ? -240 : 240 },
    { x: player.x > 0 ? -240 : 240, z: edge },
  ];
  const s = pick(rng, spots);
  const car = createCar('police', s.x, s.z, 0, 0x1a2a4a);
  car.speed = TUNE.copCarSpeed * 0.7;
  return car;
}

function spawnFootCop(city, rng, player) {
  const p = city.randomRoadPoint();
  const mesh = makePersonMesh(0x1a2a4a, 0x1a2a4a, pick(rng, [0xe8b88a, 0xc88a5a, 0xf0c8a0]));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.18, 10),
    new THREE.MeshLambertMaterial({ color: 0x101828 }));
  cap.position.y = 2.08;
  mesh.add(cap);
  mesh.position.set(p.x, 0, p.z);
  return {
    kind: 'cop', mesh, x: p.x, z: p.z,
    heading: 0, speed: TUNE.copFootSpeed, health: TUNE.copHealth,
    punchT: 0, grabT: 0, down: false,
  };
}

export function createPolice() {
  return { cars: [], foot: [], sirenOn: false };
}

export function updatePolice(police, G, dt, rng) {
  const { player, city, wanted } = G;
  const want = wanted.stars;
  const now = G.time;
  // How many units the heat calls for.
  const wantCars = want === 0 ? 0 : want <= 2 ? 1 : want <= 3 ? 2 : want <= 4 ? 3 : 4;
  const wantFoot = want === 0 ? 0 : want <= 2 ? 1 : 2;
  while (police.cars.length < wantCars) {
    const car = spawnCopCar(city, rng, player);
    police.cars.push(car);
    G.scene.add(car.mesh);
  }
  while (police.foot.length < wantFoot) {
    const cop = spawnFootCop(city, rng, player);
    police.foot.push(cop);
    G.scene.add(cop.mesh);
  }
  // Extra units leave when the heat drops.
  while (police.cars.length > wantCars) {
    const car = police.cars.pop();
    G.scene.remove(car.mesh);
  }
  while (police.foot.length > wantFoot) {
    const cop = police.foot.pop();
    G.scene.remove(cop.mesh);
  }
  let nearest = 999;
  for (const car of police.cars) {
    // Pursuit: steer toward the player's street position, with a little weave.
    const dx = player.x - car.x; const dz = player.z - car.z;
    const d = Math.hypot(dx, dz);
    nearest = Math.min(nearest, d);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += clamp(dh, -1.6 * dt, 1.6 * dt);
    const target = d > 30 ? TUNE.copCarSpeed : TUNE.copCarSpeed * 0.85;
    car.speed += clamp(target - car.speed, -12 * dt, 10 * dt);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const hit = city.collideCircle(car.x, car.z, 2.2);
    car.x = hit.x; car.z = hit.z;
    if (hit.hit) car.speed *= 0.6;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.siren = (car.siren + dt) % 1;
    const bar = car.mesh.children.find((c) => c.geometry && c.geometry.type === 'BoxGeometry' && c.position.y > 1.7);
    if (bar) bar.material.color.setHex(car.siren < 0.5 ? 0xff2a2a : PALETTE.policeLight);
    // Ram the player: a hard hit slows them and hurts on foot.
    if (d < 3.4) {
      if (player.inCar && player.car) {
        player.car.speed *= 0.55;
        player.shake = 0.5;
      } else if (!player.inCar) {
        player.health -= 22 * dt;
        player.x += (player.x - car.x) * 0.1;
        player.z += (player.z - car.z) * 0.1;
      }
      G.audio.crash();
    }
  }
  for (const cop of police.foot) {
    if (cop.down) continue;
    const dx = player.x - cop.x; const dz = player.z - cop.z;
    const d = Math.hypot(dx, dz);
    nearest = Math.min(nearest, d);
    cop.heading = Math.atan2(dx, dz);
    if (d > 1.6) {
      cop.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.z += Math.cos(cop.heading) * cop.speed * dt;
      const hit = city.collideCircle(cop.x, cop.z, 0.5);
      cop.x = hit.x; cop.z = hit.z;
    } else {
      // Grab: hold the player still; 2 seconds of it and it's over.
      cop.grabT += dt;
      cop.punchT -= dt;
      if (cop.punchT <= 0) {
        cop.punchT = 0.9;
        player.health -= 8;
        G.audio.punch();
        G.hud.toast('A cop is grabbing you — run!');
      }
      if (cop.grabT > 2) {
        G.busted = true;
        return;
      }
    }
    if (d > 2.2) cop.grabT = 0;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
    const u = cop.mesh.userData;
    u.bob = (u.bob || 0) + dt * cop.speed * 2.2;
    u.armL.rotation.x = Math.sin(u.bob) * 0.5;
    u.armR.rotation.x = -Math.sin(u.bob) * 0.5;
  }
  police.sirenOn = want > 0 && nearest < 90;
  wanted.update(now, dt, nearest);
  void range;
}
