// SOLMARINA — the three.js stage: renderer, sun-soaked dusk sky, lights,
// fog, the third-person camera rig, and the particle effects (exhaust,
// sparks, muzzle flash, mission confetti). The city itself is built by
// city.js; this file lights it and looks at it.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { clamp, lerp } from './random.js';

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 640);

  // Sky dome: a gradient shader, warm horizon to deep dusk blue.
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      low: { value: new THREE.Color(PALETTE.skyLow) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){
        float h = normalize(vP).y;
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.7, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // The low sun: a glowing disc low in the west.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-620, 150, -260);
  sun.lookAt(0, 60, 0);
  scene.add(sun);
  const sunHalo = new THREE.Mesh(
    new THREE.CircleGeometry(70, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a5a, transparent: true, opacity: 0.25, fog: false }),
  );
  sunHalo.position.set(-625, 150, -262);
  sunHalo.lookAt(0, 60, 0);
  scene.add(sunHalo);

  // Lights: warm low sun with shadows + pink sky bounce.
  const sunLight = new THREE.DirectionalLight(0xffc98a, 2.6);
  sunLight.position.set(-180, 140, -120);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -280; sunLight.shadow.camera.right = 280;
  sunLight.shadow.camera.top = 280; sunLight.shadow.camera.bottom = -280;
  sunLight.shadow.camera.far = 700;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0xffb88a, 0x8a6a5a, 0.85));
  const fill = new THREE.DirectionalLight(0x7a8ac8, 0.35);
  fill.position.set(150, 80, 200);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 2000);

  // Particles: one Points cloud, recycled. Each particle: pos, vel, life, color, size.
  const MAXP = 600;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3);
  const pCol = new Float32Array(MAXP * 3);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({
    size: 1.6, vertexColors: true, transparent: true, opacity: 0.9,
    depthWrite: false, sizeAttenuation: true,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAXP; i += 1) parts.push({ life: 0, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 });
  let pNext = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const p = parts[pNext];
    pNext = (pNext + 1) % MAXP;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.r = r; p.g = g; p.b = b;
  }
  function burst(x, y, z, n, color, speed, life, up) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      spawn(x, y, z, Math.cos(a) * s, (up || 2) * (0.5 + Math.random()), Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.8), c.r, c.g, c.b);
    }
  }

  const stage = {
    renderer, scene, camera, sunLight,
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },
    effects: {
      burst,
      exhaust(x, y, z, heading) {
        spawn(x - Math.sin(heading) * 2, y + 0.4, z - Math.cos(heading) * 2,
          -Math.sin(heading) * 2, 0.8, -Math.cos(heading) * 2, 0.5, 0.5, 0.5, 0.5);
      },
      sparks(x, y, z) { burst(x, y, z, 14, 0xffc93c, 6, 0.5, 3); },
      muzzle(player) {
        const x = player.x + Math.sin(player.heading) * 1.4;
        const z = player.z + Math.cos(player.heading) * 1.4;
        burst(x, 1.4, z, 8, 0xffe98a, 4, 0.18, 1);
      },
      confetti(player) {
        const colors = [0xff5a3c, 0xffd21f, 0x7ac74f, 0x5a9ae8, 0xff8ab0];
        for (let i = 0; i < 90; i += 1) {
          const a = Math.random() * Math.PI * 2;
          const r = 2 + Math.random() * 6;
          burst(player.x + Math.cos(a) * r, 3 + Math.random() * 4, player.z + Math.sin(a) * r,
            26, colors[i % colors.length], 3, 1.6, 1);
        }
      },
    },
    updateParticles(dt) {
      for (let i = 0; i < MAXP; i += 1) {
        const p = parts[i];
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          p.vy -= 3 * dt;
          if (p.y < 0.1) { p.y = 0.1; p.vy = 0; }
        } else {
          p.y = -99;
        }
        pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
        pCol[i * 3] = p.r; pCol[i * 3 + 1] = p.g; pCol[i * 3 + 2] = p.b;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.color.needsUpdate = true;
    },
    // Third-person camera: behind the player, smoothed, mouse orbit offsets.
    updateCamera(G, dt) {
      const p = G.player;
      const orbit = G.input.consumeOrbit();
      p.cameraYaw -= orbit.dx * 0.005;
      p.cameraPitch = clamp(p.cameraPitch + orbit.dy * 0.003, 0.05, 0.9);
      if (p.inCar && p.car) p.cameraYaw = lerp(p.cameraYaw, p.car.heading + Math.PI, 0);
      // When driving, the camera trails the car's heading unless the player drags.
      const yaw = p.inCar && p.car && Math.abs(orbit.dx) < 1 ? p.car.heading + Math.PI : p.cameraYaw;
      const dist = p.inCar ? 13 : 9;
      const height = dist * Math.tan(p.cameraPitch) + (p.inCar ? 3.2 : 2.2);
      const tx = p.x; const tz = p.z;
      const cx = tx + Math.sin(yaw) * dist;
      const cz = tz + Math.cos(yaw) * dist;
      const k = 1 - Math.pow(0.001, dt);
      camera.position.x += (cx - camera.position.x) * k;
      camera.position.y += (height - camera.position.y) * k;
      camera.position.z += (cz - camera.position.z) * k;
      if (p.shake > 0) {
        p.shake = Math.max(0, p.shake - dt);
        camera.position.x += (Math.random() - 0.5) * p.shake * 0.8;
        camera.position.y += (Math.random() - 0.5) * p.shake * 0.6;
      }
      camera.lookAt(tx, p.inCar ? 1.6 : 1.4, tz);
      // Keep the camera out of buildings: lift it when it would clip.
      const h = G.city ? 0 : 0;
      void h;
      const fovTarget = p.inCar && p.car ? 62 + clamp(Math.abs(p.car.speed) / 30, 0, 1) * 10 : 62;
      if (Math.abs(camera.fov - fovTarget) > 0.1) {
        camera.fov += (fovTarget - camera.fov) * Math.min(1, 3 * dt);
        camera.updateProjectionMatrix();
      }
    },
  };
  return stage;
}
