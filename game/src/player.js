// SOLMARINA — Marco Vela. On foot he walks, sprints, punches and shoots;
// in a car he drives. E enters the nearest car (stealing one the player
// does not own is a crime); E again steps out. Health, cash, rep and ammo
// live here, and so do pickups.
import { TUNE } from './config.js';
import { clamp } from './random.js';
import { makePersonMesh, nearestPed, knockDown } from './pedestrians.js';

export function createPlayer(city) {
  const mesh = makePersonMesh(0xffffff, 0x2a3a5a, 0xe8b88a);
  // Marco: white tee, dark jeans, coral cap.
  const cap = mesh.children.find(() => true);
  void cap;
  mesh.position.set(-216, 0, -216);
  return {
    mesh, x: -216, z: -216, heading: 0,
    speed: 0, health: TUNE.playerHealth, cash: 0, rep: 0,
    inCar: false, car: null, armed: false, ammo: 0,
    attackedRecently: 0, punchT: 0, shootT: 0, shake: 0,
    cameraYaw: Math.PI * 0.75, cameraPitch: 0.32,
  };
}

export function nearestCar(cars, x, z, maxD) {
  let best = null; let bestD = maxD;
  for (const c of cars) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best;
}

export function enterCar(G, car) {
  const { player, wanted } = G;
  player.inCar = true;
  player.car = car;
  player.mesh.visible = false;
  car.driver = true;
  if (car.kind === 'parked' || car.kind === 'traffic') {
    if (!car.stolen) {
      car.stolen = true;
      wanted.add(1, G.time);
      G.hud.toast('Car stolen! The cops are coming.');
      G.audio.star();
    }
  }
  if (car.marked) {
    G.hud.toast('That is the marked Comet. Get it to the garage.');
  }
  G.audio.click();
}

export function exitCar(G) {
  const { player } = G;
  if (!player.inCar || !player.car) return;
  const car = player.car;
  car.driver = false;
  const side = player.heading + Math.PI / 2;
  player.x = car.x + Math.sin(side) * 3;
  player.z = car.z + Math.cos(side) * 3;
  const hit = G.city.collideCircle(player.x, player.z, 0.6);
  player.x = hit.x; player.z = hit.z;
  player.inCar = false;
  player.car = null;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  G.audio.click();
}

// Foot movement: WASD relative to the camera, sprint on Shift, collide.
export function updatePlayerFoot(G, dt) {
  const { player, input, city } = G;
  const ax = input.axis();
  const sprint = input.keys['shift'] || input.keys.Shift;
  const speed = sprint ? TUNE.sprintSpeed : TUNE.walkSpeed;
  // Camera-relative movement.
  const yaw = player.cameraYaw;
  const fx = Math.sin(yaw); const fz = Math.cos(yaw);
  const rx = Math.sin(yaw - Math.PI / 2); const rz = Math.cos(yaw - Math.PI / 2);
  const mx = fx * ax.y + rx * ax.x;
  const mz = fz * ax.y + rz * ax.x;
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    const nx = player.x + (mx / len) * speed * dt;
    const nz = player.z + (mz / len) * speed * dt;
    const hit = city.collideCircle(nx, nz, 0.6);
    player.x = hit.x; player.z = hit.z;
    player.heading = Math.atan2(mx, mz);
    player.speed = speed;
  } else {
    player.speed = 0;
  }
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  const u = player.mesh.userData;
  u.bob = (u.bob || 0) + dt * player.speed * 2.2;
  u.armL.rotation.x = Math.sin(u.bob) * (player.speed > 0.1 ? 0.6 : 0.05);
  u.armR.rotation.x = -Math.sin(u.bob) * (player.speed > 0.1 ? 0.6 : 0.05);
  u.body.position.y = 1.15 + Math.abs(Math.sin(u.bob)) * 0.05;
  // Punch: F hits the nearest ped or cop in front.
  player.punchT -= dt;
  if (input.pressed('f') && player.punchT <= 0) {
    player.punchT = 0.45;
    player.attackedRecently = 1.5;
    G.audio.punch();
    const fx2 = player.x + Math.sin(player.heading) * 1.6;
    const fz2 = player.z + Math.cos(player.heading) * 1.6;
    const ped = nearestPed(G.peds, fx2, fz2, TUNE.punchRange);
    if (ped) {
      const down = knockDown(ped, player.x, player.z, TUNE.punchDamage);
      G.wanted.add(1, G.time);
      G.hud.toast(down ? 'Pedestrian down!' : 'You hit a pedestrian!');
    } else {
      for (const cop of G.police.foot) {
        if (!cop.down && Math.hypot(cop.x - fx2, cop.z - fz2) < TUNE.punchRange) {
          cop.health -= TUNE.punchDamage;
          if (cop.health <= 0) {
            cop.down = true;
            cop.mesh.rotation.x = Math.PI / 2;
            G.wanted.add(2, G.time);
            G.hud.toast('Cop down! That will bring heat.');
          } else {
            G.wanted.add(1, G.time);
          }
          break;
        }
      }
    }
  }
  // Shoot: click fires the pistol at the crosshair.
  player.shootT -= dt;
  if (input.consumeClick() && player.armed && player.ammo > 0 && player.shootT <= 0) {
    player.shootT = 0.28;
    player.ammo -= 1;
    player.attackedRecently = 1.5;
    G.audio.shot();
    G.effects.muzzle(player);
    const rangeMax = 60;
    const dirX = Math.sin(player.heading); const dirZ = Math.cos(player.heading);
    let hitPed = nearestPed(G.peds, player.x + dirX * 8, player.z + dirZ * 8, 6);
    let hitCop = null;
    for (const cop of G.police.foot) {
      if (cop.down) continue;
      const along = (cop.x - player.x) * dirX + (cop.z - player.z) * dirZ;
      const side = Math.abs((cop.x - player.x) * dirZ - (cop.z - player.z) * dirX);
      if (along > 0 && along < rangeMax && side < 1.2) { hitCop = cop; break; }
    }
    if (hitCop) {
      hitCop.health -= TUNE.pistolDamage;
      if (hitCop.health <= 0) {
        hitCop.down = true;
        hitCop.mesh.rotation.x = Math.PI / 2;
        G.wanted.add(2, G.time);
        G.hud.toast('Cop down!');
      }
    } else if (hitPed) {
      knockDown(hitPed, player.x, player.z, TUNE.pistolDamage);
      G.wanted.add(1, G.time);
    }
  }
  player.attackedRecently = Math.max(0, player.attackedRecently - dt);
  // Pickups: walk over a crate to take it.
  for (const p of city.pickups) {
    if (p.taken) continue;
    if (Math.hypot(p.x - player.x, p.z - player.z) < 2.2) {
      p.taken = true;
      if (p.kind === 'health') {
        player.health = clamp(player.health + p.amount, 0, TUNE.playerHealth);
        G.hud.toast(`+${p.amount} health`);
      } else {
        player.armed = true;
        player.ammo += p.amount;
        G.hud.toast(`Pistol ammo +${p.amount}`);
      }
      G.audio.pickup();
      if (p.mesh) p.mesh.visible = false;
    }
  }
}
