// SOLMARINA — cars. A low-poly car is boxes: body, cabin, wheels, lights.
// Traffic follows the street grid on waypoints; the player's car uses
// arcade physics (accelerate, steer by speed, handbrake drift). Stealing a
// car is a crime — the police module watches for it.
import * as THREE from 'three';
import { CITY, PALETTE, TUNE } from './config.js';
import { chance, clamp, pick, range } from './random.js';

const TRAFFIC_COLORS = [0xd8d0c0, 0x5a7a9a, 0x9a3a3a, 0x3a5a4a, 0x8a6a9a, 0xc8a03a, 0x4a4a5a, 0x7a9a5a];

export function makeCarMesh(color, kind) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2432 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.65; body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.3, -0.2); cabin.castShadow = true;
  g.add(body); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const wx of [-0.7, 0.7]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    l.position.set(wx, 0.75, 2.22);
    g.add(l);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: PALETTE.policeBlue }));
    bar.position.set(0, 1.75, -0.2);
    g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 4.42),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.72;
    g.add(stripe);
  }
  if (kind === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.4), bodyMat);
    spoiler.position.set(0, 1.25, -2.1);
    g.add(spoiler);
  }
  g.userData.wheels = wheels;
  return g;
}

export function createCar(kind, x, z, heading, color) {
  const mesh = makeCarMesh(color, kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    kind, mesh, color,
    x, z, heading, speed: 0, steer: 0,
    route: null, wait: 0, stuck: 0,
    driver: kind !== 'parked', // traffic cars have drivers; parked ones don't
    stolen: false, siren: 0,
  };
}

export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = city.randomRoadPoint();
    const alongX = Math.abs(p.z - CITY.streetLines.reduce((a, b) => (Math.abs(p.z - b) < Math.abs(p.z - a) ? b : a))) < 1;
    const heading = alongX ? (chance(rng, 0.5) ? 0 : Math.PI) : (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar('traffic', p.x, p.z, heading, pick(rng, TRAFFIC_COLORS));
    car.speed = range(rng, TUNE.trafficSpeed[0], TUNE.trafficSpeed[1]);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(city, rng) {
  const spots = [
    { x: 36, z: -20, h: Math.PI / 2, color: PALETTE.sportsYellow, kind: 'sports', marked: true },
    { x: -100, z: 88, h: 0, color: 0xd8d0c0, kind: 'parked' },
    { x: 150, z: -60, h: Math.PI, color: 0x9a3a3a, kind: 'parked' },
    { x: -60, z: -150, h: -Math.PI / 2, color: 0x5a7a9a, kind: 'parked' },
    { x: 200, z: 150, h: Math.PI / 2, color: 0x3a5a4a, kind: 'parked' },
    { x: -200, z: 40, h: 0, color: 0xc8a03a, kind: 'parked' },
    { x: 60, z: 200, h: Math.PI, color: 0x8a6a9a, kind: 'parked' },
  ];
  return spots.map((s) => {
    const car = createCar(s.kind, s.x, s.z, s.h, s.color);
    car.marked = !!s.marked;
    return car;
  });
}

// Traffic: follow the street you are on; at an intersection, turn or go on.
// Stop for the car ahead. Cars never leave the road.
export function updateTraffic(car, city, others, dt, rng) {
  if (car.wait > 0) { car.wait -= dt; return; }
  const aheadX = car.x + Math.sin(car.heading) * 7;
  const aheadZ = car.z + Math.cos(car.heading) * 7;
  for (const o of others) {
    if (o === car) continue;
    const dx = o.x - car.x; const dz = o.z - car.z;
    const d = Math.hypot(dx, dz);
    if (d < 7 && Math.abs(Math.atan2(dx, dz) - car.heading) < 0.8) {
      car.speed = Math.max(0, car.speed - 14 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      return;
    }
  }
  void aheadX; void aheadZ;
  const target = range(rng, TUNE.trafficSpeed[0], TUNE.trafficSpeed[1]);
  car.speed += clamp(target - car.speed, -10 * dt, 8 * dt);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  // At an intersection, maybe turn onto the crossing street.
  const nearX = CITY.streetLines.some((s) => Math.abs(car.x - s) < 1.2);
  const nearZ = CITY.streetLines.some((s) => Math.abs(car.z - s) < 1.2);
  if (nearX && nearZ && chance(rng, dt * 0.5)) {
    car.heading += pick(rng, [-Math.PI / 2, Math.PI / 2]);
  }
  // Keep on the grid: if we drifted off-road, steer back to the nearest street.
  if (!city.onRoad(car.x, car.z)) {
    const sx = CITY.streetLines.reduce((a, b) => (Math.abs(car.x - b) < Math.abs(car.x - a) ? b : a));
    const sz = CITY.streetLines.reduce((a, b) => (Math.abs(car.z - b) < Math.abs(car.z - a) ? b : a));
    if (Math.abs(car.x - sx) < Math.abs(car.z - sz)) {
      car.heading = car.z > sz ? Math.PI : 0;
    } else {
      car.heading = car.x > sx ? -Math.PI / 2 : Math.PI / 2;
    }
  }
  const hit = city.collideCircle(car.x, car.z, 2.2);
  car.x = hit.x; car.z = hit.z;
  if (hit.hit) car.speed *= 0.5;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (const w of car.mesh.userData.wheels) w.rotation.x += (car.speed * dt) / 0.42;
}

// Arcade driving for the player's car: accelerate, steer by speed, drift.
export function drivePlayerCar(car, ax, handbrake, dt, city) {
  const maxSpeed = 30;
  const maxReverse = TUNE.reverseMax;
  if (ax.y > 0) car.speed += TUNE.accel * dt * ax.y;
  else if (ax.y < 0) {
    car.speed += (car.speed > 0.5 ? -TUNE.brake : -TUNE.accel * 0.6) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  car.speed = clamp(car.speed, -maxReverse, maxSpeed);
  const grip = handbrake ? TUNE.handbrakeGrip : TUNE.carGrip;
  const steerTarget = ax.x * TUNE.steerMax * clamp(Math.abs(car.speed) / 8, 0.25, 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, 8 * dt);
  car.heading += (car.steer * car.speed * grip * 0.09) * dt * (car.speed >= 0 ? 1 : -1);
  if (handbrake) car.speed *= (1 - 0.6 * dt);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  const hit = city.collideCircle(car.x, car.z, 2.2);
  if (hit.hit) {
    car.x = hit.x; car.z = hit.z;
    if (Math.abs(car.speed) > 12) car.speed *= -0.25;
    else car.speed *= 0.4;
  }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  for (const w of car.mesh.userData.wheels) {
    w.rotation.x += (car.speed * dt) / 0.42;
    w.rotation.y = car.steer * 0.4;
  }
  return Math.abs(car.speed) > 12 && hit.hit;
}
