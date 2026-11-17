// SOLMARINA — the city of Solmarina, built from one seed: a 9x9 grid of
// blocks, streets between them, a beach along the south edge and a marina
// on the east. Everything is drawn in code — the ground is one painted
// canvas texture, the buildings are boxes with window facades, the palms
// are instanced. This module also owns collision: circle vs building boxes.
import * as THREE from 'three';
import { CITY, PALETTE, PICKUPS } from './config.js';
import { chance, pick, range, rangeInt } from './random.js';

const WORLD = 320; // ground texture covers -320..320 in x and z

function worldToUv(v) {
  return ((v + WORLD) / (WORLD * 2)) * 1024;
}

function facadeTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 128, 3);
  for (let y = 14; y < 250; y += 32) {
    for (let x = 12; x < 120; x += 28) {
      g.fillStyle = lit && Math.random() < 0.35 ? '#ffd98a' : '#2a3548';
      g.fillRect(x, y, 16, 20);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, 16, 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture(city) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  const W = (v) => worldToUv(v);
  // Block interiors: warm concrete and grass.
  g.fillStyle = '#9a8f7a'; g.fillRect(0, 0, 1024, 1024);
  for (let bz = 0; bz < CITY.blocks; bz += 1) {
    for (let bx = 0; bx < CITY.blocks; bx += 1) {
      const cx = -216 + bx * CITY.pitch; const cz = -216 + bz * CITY.pitch;
      g.fillStyle = (bx + bz) % 2 ? '#8f9a6b' : '#a89a7d';
      g.fillRect(W(cx - 20), W(cz - 20), W(40) - W(0), W(40) - W(0));
    }
  }
  // Sidewalks: pale bands along every street.
  g.fillStyle = PALETTE.groundSidewalk;
  for (const s of CITY.streetLines) {
    g.fillRect(0, W(s - 7), 1024, W(14) - W(0));
    g.fillRect(W(s - 7), 0, W(14) - W(0), 1024);
  }
  // Asphalt: dark bands with dashed centre lines.
  g.fillStyle = PALETTE.groundAsphalt;
  for (const s of CITY.streetLines) {
    g.fillRect(0, W(s - 5), 1024, W(10) - W(0));
    g.fillRect(W(s - 5), 0, W(10) - W(0), 1024);
  }
  g.fillStyle = '#d8c86a';
  for (const s of CITY.streetLines) {
    for (let v = -310; v < 310; v += 16) {
      g.fillRect(W(v), W(s - 0.6), W(8) - W(0), W(1.2) - W(0));
      g.fillRect(W(s - 0.6), W(v), W(1.2) - W(0), W(8) - W(0));
    }
  }
  // Plaza: paved centre with a fountain ring.
  g.fillStyle = '#c8b89a';
  g.fillRect(W(-27), W(-27), W(54) - W(0), W(54) - W(0));
  g.strokeStyle = '#7a8a9a'; g.lineWidth = 4;
  g.beginPath(); g.arc(W(0), W(0), W(10) - W(0), 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#5a9ab8';
  g.beginPath(); g.arc(W(0), W(0), W(8) - W(0), 0, Math.PI * 2); g.fill();
  // Parks: green with tree dots.
  for (const p of CITY.parks) {
    const cx = -216 + p.x * CITY.pitch; const cz = -216 + p.z * CITY.pitch;
    g.fillStyle = '#6a8a4a';
    g.fillRect(W(cx - 20), W(cz - 20), W(40) - W(0), W(40) - W(0));
    g.fillStyle = '#4a6a34';
    for (let i = 0; i < 14; i += 1) {
      g.beginPath();
      g.arc(W(cx - 14 + ((i * 37) % 28)), W(cz - 14 + ((i * 53) % 28)), 5, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Beach: sand south of the city, then the sea.
  g.fillStyle = PALETTE.groundSand;
  g.fillRect(0, W(CITY.beachAt), 1024, W(CITY.seaAt) - W(CITY.beachAt));
  g.fillStyle = '#7ab8c8';
  for (let i = 0; i < 40; i += 1) {
    g.fillRect(0, W(CITY.seaAt + i * 1.6), 1024, 2);
  }
  g.fillStyle = '#2e7f9e';
  g.fillRect(0, W(CITY.seaAt), 1024, 1024 - W(CITY.seaAt));
  // Marina: wooden docks on the east edge.
  g.fillStyle = '#8a6a4a';
  for (let z = -160; z <= 160; z += 80) {
    g.fillRect(W(CITY.marinaAt), W(z - 4), W(46) - W(0), W(8) - W(0));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildCity(rng) {
  const group = new THREE.Group();
  group.name = 'solmarina-city';
  const buildings = [];
  const colliders = [];

  // Ground: one painted plane, plus a separate sea plane that shimmers.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD * 2, WORLD * 2),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(640, 90),
    new THREE.MeshPhongMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.85, shininess: 120 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.15, CITY.seaAt + 45);
  group.add(sea);

  // Facades: three shared window textures.
  const facades = [
    facadeTexture('#f2e3c6', true),
    facadeTexture('#e8b48a', true),
    facadeTexture('#a8c8c0', false),
  ];
  const roofMats = PALETTE.buildingRoof.map(
    (c) => new THREE.MeshLambertMaterial({ color: c }),
  );
  const wallMats = facades.map((t) => new THREE.MeshLambertMaterial({ map: t }));

  function addBuilding(cx, cz, w, d, h) {
    const mat = pick(rng, wallMats);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(cx, h / 2, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 1, d + 0.6), pick(rng, roofMats));
    roof.position.set(cx, h + 0.5, cz);
    group.add(roof);
    if (chance(rng, 0.4)) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 2),
        new THREE.MeshLambertMaterial({ color: 0x8a8a8a }));
      ac.position.set(cx + range(rng, -w / 4, w / 4), h + 1.6, cz + range(rng, -d / 4, d / 4));
      group.add(ac);
    }
    buildings.push({ x: cx, z: cz, w, d, h });
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
  }

  // Blocks: 2x2 lots each; hotels along the beachfront row.
  for (let bz = 0; bz < CITY.blocks; bz += 1) {
    for (let bx = 0; bx < CITY.blocks; bx += 1) {
      if (bx === CITY.plazaBlock.x && bz === CITY.plazaBlock.z) continue;
      if (CITY.parks.some((p) => p.x === bx && p.z === bz)) continue;
      const cx = -216 + bx * CITY.pitch;
      const cz = -216 + bz * CITY.pitch;
      const hotel = bz === CITY.hotelRow;
      for (const [ox, oz] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) {
        if (!chance(rng, hotel ? 0.95 : 0.72)) continue;
        const w = range(rng, 11, 17); const d = range(rng, 11, 17);
        const h = hotel ? range(rng, 26, 52) : range(rng, 7, 30);
        addBuilding(cx + ox, cz + oz, w, d, h);
      }
    }
  }

  // Plaza fountain.
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 10, 1.6, 24),
    new THREE.MeshLambertMaterial({ color: 0x8a94a0 }),
  );
  fountain.position.set(0, 0.8, 0);
  fountain.castShadow = true;
  group.add(fountain);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8, 0.4, 24),
    new THREE.MeshPhongMaterial({ color: 0x5a9ab8, shininess: 140 }),
  );
  water.position.set(0, 1.7, 0);
  group.add(water);

  // Palms: instanced trunks + fronds along the beach, marina and parks.
  const palmSpots = [];
  for (let x = -240; x <= 240; x += 24) palmSpots.push([x + range(rng, -4, 4), 258 + range(rng, 0, 40)]);
  for (const p of CITY.parks) {
    const cx = -216 + p.x * CITY.pitch; const cz = -216 + p.z * CITY.pitch;
    for (let i = 0; i < 8; i += 1) palmSpots.push([cx + range(rng, -16, 16), cz + range(rng, -16, 16)]);
  }
  for (let z = -200; z <= 200; z += 40) palmSpots.push([258 + range(rng, 0, 8), z]);
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const frondGeo = new THREE.ConeGeometry(3.2, 3.4, 7);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f7a3a });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length);
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  palmSpots.forEach(([x, z], i) => {
    const lean = range(rng, -0.12, 0.12);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), lean);
    m4.compose(new THREE.Vector3(x, 3.5, z), q, new THREE.Vector3(1, 1, 1));
    trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x + lean * 6, 7.6, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    fronds.setMatrixAt(i, m4);
    void up;
  });
  trunks.castShadow = true;
  group.add(trunks); group.add(fronds);

  // Streetlights along the avenues, instanced poles + glowing heads.
  const lightSpots = [];
  for (const s of CITY.streetLines) {
    for (let v = -220; v <= 220; v += 44) {
      lightSpots.push([s + 8, v]);
      lightSpots.push([v, s + 8]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 6, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lightSpots.length);
  const headGeo = new THREE.SphereGeometry(0.45, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lightSpots.length);
  lightSpots.forEach(([x, z], i) => {
    m4.compose(new THREE.Vector3(x, 3, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    poles.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 6.2, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    heads.setMatrixAt(i, m4);
  });
  group.add(poles); group.add(heads);

  // Marina boats: simple hulls bobbing at the docks.
  const boats = [];
  for (let i = 0; i < 4; i += 1) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 10),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8e0d0, 0x5a8ac8, 0xd85a3c]) }));
    hull.position.y = 0.8;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 4),
      new THREE.MeshLambertMaterial({ color: 0xf7f0dd }));
    cabin.position.set(0, 2.2, -1);
    boat.add(hull); boat.add(cabin);
    boat.position.set(278 + range(rng, -4, 14), 0, -160 + i * 80 + range(rng, -8, 8));
    boat.rotation.y = Math.PI / 2 + range(rng, -0.1, 0.1);
    group.add(boat);
    boats.push(boat);
  }

  // Pickup markers (health / ammo crates) — meshes added by player.js data.
  const city = {
    group, buildings, colliders, boats, sea,
    blockCenter(bx, bz) { return { x: -216 + bx * CITY.pitch, z: -216 + bz * CITY.pitch }; },
    onRoad(x, z) {
      return CITY.streetLines.some((s) => Math.abs(x - s) < 6.5 || Math.abs(z - s) < 6.5);
    },
    collideCircle(x, z, r) {
      let hit = false;
      for (const b of colliders) {
        const nx = Math.max(b.minX, Math.min(x, b.maxX));
        const nz = Math.max(b.minZ, Math.min(z, b.maxZ));
        const dx = x - nx; const dz = z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            x = nx + (dx / d) * r; z = nz + (dz / d) * r;
          } else {
            x += r;
          }
        }
      }
      x = Math.max(-310, Math.min(310, x));
      z = Math.max(-310, Math.min(312, z));
      return { x, z, hit };
    },
    randomRoadPoint() {
      if (chance(rng, 0.5)) {
        return { x: pick(rng, CITY.streetLines), z: range(rng, -235, 235) };
      }
      return { x: range(rng, -235, 235), z: pick(rng, CITY.streetLines) };
    },
    pickups: PICKUPS.map((p) => ({ ...p, taken: false })),
  };
  return city;
}

export function buildingHeightAt(city, x, z) {
  for (const b of city.buildings) {
    if (x > b.x - b.w / 2 && x < b.x + b.w / 2 && z > b.z - b.d / 2 && z < b.z + b.d / 2) return b.h;
  }
  return 0;
}

export function makeBeacon(color) {
  const geo = new THREE.CylinderGeometry(3, 3, 60, 16, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.6, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.25;
  const g = new THREE.Group();
  g.add(mesh); g.add(ring);
  return g;
}
