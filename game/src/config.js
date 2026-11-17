// SOLMARINA — one place for every number that shapes the game: the palette
// tokens (21st.dev rule: tokens first, then components), the city layout,
// the tuning, and the three story missions. Nothing else hard-codes a colour
// or a magic number; change it here and the whole city follows.

// Palette — one sun-soaked dusk: warm sky, terracotta and cream buildings,
// aqua sea, hot coral as the single accent the HUD and the mission beacons use.
export const PALETTE = {
  skyTop: 0x2e4a7a, skyMid: 0xf28c5a, skyLow: 0xffc98a,
  sun: 0xffd9a0, fog: 0xe8956b, haze: 0x7a5a8a,
  groundAsphalt: '#3a3f4a', groundSidewalk: '#b8a88f', groundBlock: '#8f9a6b',
  groundSand: '#e8cf9a', sea: 0x2e7f9e, seaDeep: 0x1d5a78,
  building: ['#f2e3c6', '#e8b48a', '#d98a6a', '#f7f0dd', '#a8c8c0', '#e8c8a0', '#c98a7a'],
  buildingRoof: ['#b06a4a', '#7a5a4a', '#5a6a7a', '#8a6a5a'],
  glass: 0x9fd8e8, accent: '#ff5a3c', accentSoft: '#ff8a5a',
  policeBlue: 0x2a5ad8, policeLight: 0x7ab8ff,
  taxiYellow: 0xffc93c, sportsYellow: 0xffd21f,
  hudGlass: 'rgba(12,16,32,0.55)', hudBorder: 'rgba(255,255,255,0.22)',
  hudText: '#fff4e0', hudDim: '#c8b8a0', cash: '#ffd21f', health: '#ff5a3c',
};

// City grid: 9x9 blocks, streets between them, beach south, marina east.
export const CITY = {
  blocks: 9, block: 40, street: 14, pitch: 54,
  // Street centre lines, -243 .. +243. Blocks sit between them.
  streetLines: [-243, -189, -135, -81, -27, 27, 81, 135, 189, 243],
  half: 250, beachAt: 250, seaAt: 318, marinaAt: 250,
  plazaBlock: { x: 4, z: 4 },
  parks: [{ x: 1, z: 1 }, { x: 7, z: 1 }],
  hotelRow: 8, // southernmost block row: tall beachfront hotels
};

// Tuning — how the game feels.
export const TUNE = {
  walkSpeed: 6, sprintSpeed: 10.5, accel: 26, brake: 34, reverseMax: 9,
  carGrip: 3.2, handbrakeGrip: 1.1, steerMax: 0.55,
  trafficSpeed: [7, 13], pedSpeed: [1.2, 2.4], copCarSpeed: 21, copFootSpeed: 5.2,
  playerHealth: 100, copHealth: 100, pedHealth: 50,
  punchDamage: 34, punchRange: 2.4, pistolDamage: 40, pistolAmmo: 12,
  wantedDecayIdle: 9, // seconds of no crime and no cop near before -1 star
  missionFailSeconds: 0,
};

export const SAVE_KEY = 'solmarina-save-v1';

// The story: Marco Vela, courier in Solmarina. Three missions, one arc.
export const MISSIONS = [
  {
    id: 'm1', title: 'FIRST DELIVERY', reward: 150, rep: 1, timeLimit: 180,
    brief: 'Marco needs cash. Pick up the package at the marina dock and deliver it to the Palms Hotel on the beachfront. Fast, quiet, no trouble.',
    steps: [
      { text: 'Pick up the package at the marina dock', target: { x: 268, z: -120 }, radius: 6 },
      { text: 'Deliver it to the Palms Hotel, beachfront', target: { x: -40, z: 232 }, radius: 7 },
    ],
  },
  {
    id: 'm2', title: 'THE MARKED CAR', reward: 400, rep: 2, timeLimit: 240,
    brief: 'A client wants the yellow Comet parked at Solmarina Plaza — no questions. Steal it, lose the cops, and bring it to the garage up north.',
    steps: [
      { text: 'Steal the yellow Comet at Solmarina Plaza', target: { x: 0, z: 0 }, radius: 8, steal: true },
      { text: 'Lose the cops — get your wanted level to zero', target: null, loseCops: true },
      { text: 'Deliver the Comet to the north garage', target: { x: -81, z: -228 }, radius: 8 },
    ],
  },
  {
    id: 'm3', title: 'HARBOR RUN', reward: 1000, rep: 3, timeLimit: 240,
    brief: 'The whole city is after you now. Five stars. Drive from the plaza to the midnight ferry at the marina and get out of Solmarina alive.',
    steps: [
      { text: 'Reach the midnight ferry at the marina — do not stop', target: { x: 285, z: 60 }, radius: 9, heat: 5 },
    ],
  },
];

export const PICKUPS = [
  { kind: 'health', x: -135, z: 108, amount: 40 },
  { kind: 'health', x: 135, z: -108, amount: 40 },
  { kind: 'ammo', x: 81, z: 189, amount: 12 },
  { kind: 'ammo', x: -189, z: -81, amount: 12 },
  { kind: 'health', x: 27, z: -189, amount: 40 },
];

export const HIDEOUT = { x: -216, z: -216 };
