// VELA BAY — settings (all design numbers, fresh from the design spec).
// City: 9x9 blocks of 64 m, streets 16 m, grid -256..256, half 288.
// Beach z>=224, docks x>=224, sea z>=296. Day length 480 s.

export const CFG = {
  title: 'VELA BAY',
  block: 64,
  street: 16,
  half: 288,
  gridMin: -256,
  gridMax: 256,
  gridStep: 64,
  beachZ: 224,
  docksX: 224,
  seaZ: 296,
  dayLength: 480,
  clamp: 300,

  spawn: { x: -60, z: -150, heading: Math.PI / 2 },
  safehouse: { x: -60, z: -168 },
  garage: { x: -120, z: 24 },
  yacht: { x: 60, z: 232 },
  marina: { x: 60, z: 232 },

  drive: { accel: 16, brake: 30, reverse: 9, maxSpeed: 42, steer: 1.9, drag: 0.35 },
  walkSpeed: 6,
  runSpeed: 9,

  cam: {
    ease: 2.2,
    easeNear: 1.4,
    idleDelay: 1.5,
    baseDist: 11,
    speedDist: 0.06,
    fovMin: 62,
    fovMax: 70,
    height: 4.2,
  },

  msgMs: 3000,
  msgMissionMs: 3500,
  msgPassMs: 5000,

  sun: {
    pos: [-260, 78, 330],
    discR: 36,
    haloR: 58,
    dayColor: 0xff8a1e,
    duskColor: 0xff5a14,
    haloOpacity: 0.28,
  },

  clockStart: 18 * 60 + 53, // 18:53, minutes since midnight
  clockRate: 0.25, // minutes per second

  weapons: [
    { name: 'Pistol', short: 'PST', dmg: 34, range: 42, rate: 0.32, ammo: Infinity, color: 0xffe08a },
    { name: 'SMG', short: 'SMG', dmg: 22, range: 36, rate: 0.11, ammo: 120, color: 0x9ad1ff },
  ],
  enemyShotDmg: 2,

  radio: [
    { name: 'COSTA 88', dj: 'DJ Neon', track: 'Neon Coastline', bpm: 112, base: 55 },
    { name: 'LA VOZ 104', dj: 'La Voz', track: 'Calle Ocho Nights', bpm: 96, base: 49 },
    { name: 'ONDA 97', dj: 'DJ Marea', track: 'Tide Runner', bpm: 122, base: 61 },
  ],

  trafficCount: 14,
  pedCount: 12,

  saveKey: 'velabay-save-v1',

  repPerMission: 160,
  repPerMetre: 1 / 50,
  ranks: [
    { at: 0, name: 'ROOKIE' },
    { at: 400, name: 'DRIVER' },
    { at: 900, name: 'KING OF VELA' },
  ],
};

// Missions (step 1-based). Total cash $19,000.
export const MISSIONS = [
  {
    id: 1, name: 'First Wheels', cash: 500, chapter: 'CH.1 — ARRIVAL',
    brief: 'Mara needs wheels. Take the coupe from the garage and bring it home.',
    steps: [
      { text: 'Get the coupe at the garage (-120, 24) — press E', at: { x: -120, z: 24, r: 6 }, needE: true },
      { text: 'Drive home to the safehouse', at: { x: -60, z: -168, r: 8 } },
    ],
  },
  {
    id: 2, name: 'The Pickup', cash: 800, chapter: 'CH.1 — ARRIVAL',
    brief: 'A package waits at the docks. No questions. Bring it home.',
    steps: [
      { text: 'Pick up the package at the docks (264, 60) — press E', at: { x: 264, z: 60, r: 6 }, needE: true },
      { text: 'Drive home to the safehouse', at: { x: -60, z: -168, r: 8 } },
    ],
  },
  {
    id: 3, name: 'Hot Pursuit', cash: 1200, chapter: 'CH.2 — HEAT',
    brief: 'VBPD is on you — 3 stars. Lose them. All of them.',
    steps: [
      { text: 'Lose the heat — get to 0 stars', stars: 3, lose: true },
    ],
  },
  {
    id: 4, name: 'Dockside Deal', cash: 2000, chapter: 'CH.2 — HEAT',
    brief: 'Rook set a trap at the docks. Four of his men. Clear them out, take the cash.',
    steps: [
      { text: 'Take out the 4 dealers at the docks (264, 120)', kill: 4, at: { x: 264, z: 120, r: 30 } },
      { text: 'Grab the cash — press E', at: { x: 264, z: 120, r: 6 }, needE: true },
    ],
  },
  {
    id: 5, name: 'Getaway Driver', cash: 2500, chapter: 'CH.3 — THE JOB',
    brief: 'Mara is waiting at the marina. 90 seconds to the north fence. Drive like the bay is burning.',
    steps: [
      { text: 'Pick up Mara at the marina (60, 232)', at: { x: 60, z: 232, r: 8 }, noE: true },
      // The north fence marker sits at the edge of a city block, so the
      // arrival zone is wide — a driver stops at the building face.
      { text: 'Reach the north fence (-150, -232) — 90s left', at: { x: -150, z: -232, r: 25 }, timer: 90 },
    ],
  },
  {
    id: 6, name: 'The Informant', cash: 3000, chapter: 'CH.3 — THE JOB',
    brief: 'The green sedan circling the plaza knows where Rook keeps the ledger. Ram it off the road.',
    steps: [
      { text: 'Ram the green sedan until it stops', ram: true },
    ],
  },
  {
    id: 7, name: 'Beachfront Heist', cash: 4000, chapter: 'CH.4 — KING OF VELA',
    brief: 'A van full of casino cash sits on the beach. Steal it, lose the 3-star tail, bring it home.',
    steps: [
      { text: 'Steal the van on the beach (-180, 232) — press E', at: { x: -180, z: 232, r: 7 }, needE: true },
      { text: 'Lose the heat — get to 0 stars', stars: 3, lose: true },
      { text: 'Drive the van home to the safehouse', at: { x: -60, z: -168, r: 8 } },
    ],
  },
  {
    id: 8, name: 'King of Vela', cash: 5000, chapter: 'CH.4 — KING OF VELA',
    brief: 'The whole bay is watching. Survive 60 seconds at 4 stars, then vanish to the yacht.',
    steps: [
      { text: 'Survive 60 seconds at 4 stars', stars: 4, survive: 60 },
      { text: 'Escape to the yacht La Sirena (60, 232)', at: { x: 60, z: 232, r: 10 } },
    ],
  },
];

export const TOTAL_CASH = MISSIONS.reduce((s, m) => s + m.cash, 0); // 19000

export const DISTRICTS = [
  { name: 'OLD TOWN', x: -180, z: -180 },
  { name: 'THE PLAZA', x: 40, z: 80 },
  { name: 'MARINA', x: 60, z: 232 },
  { name: 'THE DOCKS', x: 250, z: 90 },
  { name: 'CASINO ROW', x: 120, z: 180 },
  { name: 'PALM BEACH', x: -120, z: 250 },
  { name: 'NORTH GATE', x: -150, z: -240 },
];

export const BILLBOARDS = [
  { text: 'HOTEL MIRAMAR', x: -120, z: 210, color: '#ff9a3d' },
  { text: 'CASINO DEL MAR', x: 120, z: 210, color: '#ff4d6d' },
];
