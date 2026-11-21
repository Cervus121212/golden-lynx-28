// VELA BAY — boot: entry point, game loop, player, pedestrians, save.
// Builds window.__game exactly per the design contract.
import * as THREE from '../vendor/three.module.js';
import { CFG, MISSIONS, TOTAL_CASH } from './settings.js';
import { makeRng, seedFromString } from './rng.js';
import { makeInput } from './keys.js';
import { makeSound } from './sound.js';
import { buildTown } from './town.js';
import { makeCars } from './cars.js';
import { makePolice } from './cops.js';
import { makeCombat } from './fight.js';
import { makeDisplay } from './display.js';
import { makeCamera } from './camera.js';
import { makeQuests } from './quests.js';
import { makePoses } from './poses.js';
import { runSelftest } from './selftest.js';

window.__errors = [];
window.__failedReqs = [];
window.__fps = 0;
window.__autopilotResults = null;
window.__trace = [];
window.addEventListener('error', (e) => {
  window.__errors.push(String(e.message || e.error || 'error'));
});
window.addEventListener('error', (e) => {
  const t = e.target;
  if (t && (t.src || t.href)) window.__failedReqs.push(String(t.src || t.href));
}, true);

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam ? seedFromString(seedParam) : (Date.now() % 100000);
const rng = makeRng(seed);
const isAutopilot = params.get('autopilot') === '1';
const shotParam = params.get('shot');
const lowfx = params.get('lowfx') === '1';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(lowfx ? 0.75 : Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a3a5a);
scene.fog = new THREE.Fog(0x2a3a5a, 120, 520);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x3a2a1a, 0.9);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(0xffd9a0, 1.3);
sunLight.position.set(-260, 180, 330);
scene.add(sunLight);

const input = makeInput(canvas);
const sound = makeSound();
const town = buildTown(scene, rng);
const cars = makeCars(scene, town, rng);
const police = makePolice(scene, town, rng);
const combat = makeCombat(scene);
const display = makeDisplay(document);
const cam = makeCamera(camera);

const player = {
  x: CFG.spawn.x,
  z: CFG.spawn.z,
  heading: CFG.spawn.heading,
  health: 100,
  armour: 0,
  car: null,
  mesh: null,
  distance: 0,
};

// On-foot character: jacket body, head, cap.
{
  const g = new THREE.Group();
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.45),
    new THREE.MeshLambertMaterial({ color: 0x2a6ac2 }));
  jacket.position.y = 1.0;
  g.add(jacket);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
  head.position.y = 1.85;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.14, 10),
    new THREE.MeshLambertMaterial({ color: 0xd23a4a }));
  cap.position.y = 2.1;
  g.add(cap);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x222222 }));
  legs.position.y = 0.35;
  g.add(legs);
  g.position.set(player.x, 0, player.z);
  scene.add(g);
  player.mesh = g;
}

const game = {
  cash: 0,
  time: CFG.clockStart, // minutes since midnight
  dayT: 0,
  state: 'title',
  timeScale: 1,
  sirenActive: false,
  frames: 0,
  _hudTick: 0,
  _fpsEMA: 0,
  _lastT: performance.now(),
  _deadTimer: 0,
  frozen: false,
};

const ctx = {
  scene, camera, cam, cars, police, combat, display, sound, player, town, game,
  saveGame: () => saveGame(),
};
const missions = makeQuests(ctx);
const poses = makePoses(ctx);

// Pedestrians: 12 walkers; 5 on the beach in bright clothes, flee cars < 6 m.
const pedestrians = [];
{
  const bright = [0xff4d6d, 0x3ddc97, 0x4dc3ff, 0xffd23d, 0xc77dff];
  const plain = [0x8a8a8a, 0x5a6a7a, 0x9a8a6a, 0x6a5a4a];
  for (let i = 0; i < CFG.pedCount; i++) {
    const onBeach = i < 5;
    const color = onBeach ? bright[i % bright.length] : plain[i % plain.length];
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.4),
      new THREE.MeshLambertMaterial({ color }));
    body.position.y = 0.95;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
    head.position.y = 1.8;
    g.add(head);
    let x;
    let z;
    if (onBeach) {
      x = -180 + i * 70;
      z = 292 + (i % 2) * 4;
    } else {
      const p = town.randomRoadPoint(rng);
      x = p.x;
      z = p.z;
    }
    g.position.set(x, 0, z);
    scene.add(g);
    pedestrians.push({
      mesh: g, x, z, heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.2), tx: x, tz: z, fleeing: false,
    });
  }
}

function updatePedestrians(dt) {
  for (const p of pedestrians) {
    // Flee: any car (player car or traffic) closer than 6 m.
    let threat = null;
    let td = 6;
    const carsToCheck = player.car ? [player.car, ...cars.traffic] : cars.traffic;
    for (const c of carsToCheck) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < td) { td = d; threat = c; }
    }
    if (threat) {
      p.fleeing = true;
      const away = Math.atan2(p.x - threat.x, p.z - threat.z);
      const stepLen = 5 * dt;
      // Run straight away; if a wall blocks the escape, slide along it
      // on a steady side instead of pressing into the wall.
      let h = away;
      let f = town.collide(p.x + Math.sin(h) * stepLen, p.z + Math.cos(h) * stepLen, 0.5);
      if (Math.hypot(f.x - p.x, f.z - p.z) < stepLen * 0.5) {
        if (p.fleeTurn === undefined) p.fleeTurn = 1;
        h = away + (p.fleeTurn * Math.PI) / 2;
        f = town.collide(p.x + Math.sin(h) * stepLen, p.z + Math.cos(h) * stepLen, 0.5);
        if (Math.hypot(f.x - p.x, f.z - p.z) < stepLen * 0.5) {
          p.fleeTurn = -p.fleeTurn;
          h = away + (p.fleeTurn * Math.PI) / 2;
          f = town.collide(p.x + Math.sin(h) * stepLen, p.z + Math.cos(h) * stepLen, 0.5);
        }
      }
      p.heading = h;
      p.x = f.x;
      p.z = f.z;
    } else {
      p.fleeing = false;
      const d = Math.hypot(p.tx - p.x, p.tz - p.z);
      if (d < 2) {
        const np = town.randomRoadPoint(rng);
        p.tx = np.x;
        p.tz = np.z;
      }
      p.heading = Math.atan2(p.tx - p.x, p.tz - p.z);
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
    }
    const fixed = town.collide(p.x, p.z, 0.5);
    p.x = fixed.x;
    p.z = fixed.z;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
  }
}

function rep() {
  return missions.completed.size * CFG.repPerMission + player.distance * CFG.repPerMetre;
}

function saveGame() {
  try {
    const data = {
      cash: game.cash,
      completed: [...missions.completed],
      distance: player.distance,
      x: player.x,
      z: player.z,
      time: game.time,
      dayT: game.dayT,
    };
    localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    game.save = data;
  } catch { /* storage unavailable */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return false;
    const data = JSON.parse(raw);
    game.cash = data.cash || 0;
    missions.completed = new Set(data.completed || []);
    player.distance = data.distance || 0;
    player.x = data.x ?? CFG.spawn.x;
    player.z = data.z ?? CFG.spawn.z;
    game.time = data.time ?? CFG.clockStart;
    game.dayT = data.dayT ?? 0;
    game.save = data;
    return true;
  } catch {
    return false;
  }
}

function die() {
  game.state = 'dead';
  sound.fail();
  display.msg('WASTED — you wake up at the safehouse. The bay keeps your cash, not your pride.', 5000);
  if (missions.active) missions.fail('You got wasted.');
  police.setStars(0);
  game._deadTimer = 2.5;
}

function respawn() {
  player.x = CFG.safehouse.x;
  player.z = CFG.safehouse.z;
  player.heading = CFG.spawn.heading;
  player.health = 100;
  player.armour = 0;
  player.car = null;
  if (player.mesh) player.mesh.position.set(player.x, 0, player.z);
  game.state = 'playing';
  display.msg('Back on your feet at the safehouse.', 3000);
}

function onPlayerHit(dmg) {
  if (game.state !== 'playing' && !isAutopilot) return;
  let rest = dmg;
  if (player.armour > 0) {
    const absorbed = Math.min(player.armour, rest);
    player.armour -= absorbed;
    rest -= absorbed;
  }
  player.health -= rest;
  if (player.health <= 0) {
    player.health = 0;
    die();
  }
}

// ---- Player actions (also the probe API) ----
function setPlayer(x, z) {
  if (player.car) {
    player.car.x = x;
    player.car.z = z;
    player.car.speed = 0;
  }
  player.x = x;
  player.z = z;
  if (player.mesh) player.mesh.position.set(x, 0, z);
}

function tryEnterCarAt(x, z) {
  if (player.car) return false;
  let best = null;
  let bd = 4;
  for (const c of cars.all) {
    if (c.dead) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return false;
  cars.traffic = cars.traffic.filter((t) => t !== best);
  player.car = best;
  player.heading = best.heading;
  return true;
}

function exitCar() {
  if (!player.car) return;
  const c = player.car;
  player.x = c.x + Math.cos(c.heading) * 2;
  player.z = c.z - Math.sin(c.heading) * 2;
  player.heading = c.heading;
  player.car = null;
  if (player.mesh) player.mesh.position.set(player.x, 0, player.z);
}

function interact() {
  if (missions.tryInteract()) return true;
  return tryEnterCarAt(player.x, player.z);
}

function resetRun() {
  game.cash = 0;
  game.time = CFG.clockStart;
  game.dayT = 0;
  game.state = isAutopilot ? 'playing' : 'title';
  player.x = CFG.spawn.x;
  player.z = CFG.spawn.z;
  player.heading = CFG.spawn.heading;
  player.health = 100;
  player.armour = 0;
  player.distance = 0;
  player.car = null;
  if (player.mesh) player.mesh.position.set(player.x, 0, player.z);
  cars.player.x = CFG.garage.x;
  cars.player.z = CFG.garage.z;
  cars.player.heading = Math.PI / 2;
  cars.player.speed = 0;
  cars.player.mesh.position.set(CFG.garage.x, 0, CFG.garage.z);
  missions.reset();
  police.clearAll();
  combat.clearEnemies();
  combat.resetAmmo();
  game.save = null;
}

// ---- Simulation step ----
function advance(dt) {
  const gdt = dt * game.timeScale;
  if (game.state === 'dead') {
    game._deadTimer -= gdt;
    if (game._deadTimer <= 0) respawn();
    return;
  }
  if (game.state === 'title') {
    // Establishing shot: slow orbit over the marina at dusk.
    const t = performance.now() / 1000;
    camera.position.set(Math.sin(t * 0.05) * 180, 60, 180 + Math.cos(t * 0.05) * 60);
    camera.lookAt(0, 0, 120);
    return;
  }
  if (game.state !== 'playing') return;

  // Clock + sun: daylight slides to dusk over the day.
  game.time += CFG.clockRate * gdt;
  game.dayT = (game.dayT + gdt / CFG.dayLength) % 1;
  const dusk = Math.min(1, game.dayT * 1.6);
  const sunCol = new THREE.Color(CFG.sun.dayColor).lerp(new THREE.Color(CFG.sun.duskColor), dusk);
  town.sun.material.color.copy(sunCol);
  town.sunHalo.material.color.copy(sunCol);
  sunLight.intensity = 1.3 - dusk * 0.55;
  hemi.intensity = 0.9 - dusk * 0.35;
  scene.background = new THREE.Color(0x2a3a5a).lerp(new THREE.Color(0x3a1a2a), dusk * 0.7);

  // Input: drive or walk.
  const axis = input.axis();
  const oldX = player.x;
  const oldZ = player.z;
  if (player.car) {
    cars.updatePlayer(gdt, axis, town, player.car);
    player.x = player.car.x;
    player.z = player.car.z;
    player.heading = player.car.heading;
    if (player.mesh) player.mesh.visible = false;
  } else {
    if (player.mesh) player.mesh.visible = true;
    const run = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    const sp = run ? CFG.runSpeed : CFG.walkSpeed;
    const fx = Math.sin(cam.yaw);
    const fz = Math.cos(cam.yaw);
    const rx = Math.cos(cam.yaw);
    const rz = -Math.sin(cam.yaw);
    let mx = fx * axis.f + rx * axis.s;
    let mz = fz * axis.f + rz * axis.s;
    const ml = Math.hypot(mx, mz);
    if (ml > 0) {
      mx /= ml;
      mz /= ml;
      let nx = player.x + mx * sp * gdt;
      let nz = player.z + mz * sp * gdt;
      const fixed = town.collide(nx, nz, 0.6);
      player.x = Math.max(-CFG.clamp, Math.min(CFG.clamp, fixed.x));
      player.z = Math.max(-CFG.clamp, Math.min(CFG.clamp, fixed.z));
      player.heading = Math.atan2(mx, mz);
      if (player.mesh) {
        player.mesh.position.set(player.x, 0, player.z);
        player.mesh.rotation.y = player.heading;
      }
    }
  }
  player.distance += Math.hypot(player.x - oldX, player.z - oldZ);

  // E / F / weapons / radio / shoot.
  if (input.consumeInteract()) interact();
  if (input.keys.has('KeyF')) {
    exitCar();
    input.keys.delete('KeyF');
  }
  if (input.keys.has('Digit1')) { combat.weaponIndex = 0; input.keys.delete('Digit1'); }
  if (input.keys.has('Digit2')) { combat.weaponIndex = 1; input.keys.delete('Digit2'); }
  if (input.keys.has('KeyQ')) { sound.nextStation(); input.keys.delete('KeyQ'); }
  if (input.keys.has('KeyM')) { sound.toggleMute(); input.keys.delete('KeyM'); }
  if (input.consumeClick() || input.keys.has('Space')) {
    if (!player.car) {
      const res = combat.shoot(player, cam.yaw);
      if (res !== 'empty' && res !== 'cool') sound.shot(combat.weaponIndex);
    }
  }
  if (input.keys.has('KeyP')) {
    saveGame();
    display.msg('Game saved.', 2000);
    input.keys.delete('KeyP');
  }

  cars.updateTraffic(gdt, town);
  police.update(gdt, player, game.frozen);
  combat.update(gdt, player, onPlayerHit);
  missions.update(gdt);
  updatePedestrians(gdt);
  cam.update(gdt, player, input, game.frozen);
  sound.update(gdt, player.car ? player.car.speed : 0);
  sound.sirenVolume = police.stars > 0 ? Math.max(0, 1 - police.nearestDist / 120) : 0;
  game.sirenActive = police.stars > 0;

  // HUD (throttled text writes).
  game._hudTick++;
  if (game._hudTick % 6 === 0) {
    display.setStars(police.stars);
    display.setCash(game.cash);
    display.setClock(game.time, game.dayT);
    display.setHealth(player.health, player.armour);
    display.setWeapon(CFG.weapons, combat.weaponIndex, combat.ammo);
    display.setRadio(sound.currentStation());
    display.setRep(rep());
    display.setSpeed(player.car ? player.car.speed : 0, !!player.car);
    display.setDistrict(town.districtAt(player.x, player.z));
    display.setProgress(missions.completed.size, MISSIONS.length);
    const mm = document.getElementById('minimap');
    if (mm) {
      const mctx = mm.getContext('2d');
      if (mctx) display.drawMinimap(mctx, player, missions, police, town);
    }
  }
}

function render() {
  renderer.render(scene, camera);
  game.frames++;
  const now = performance.now();
  const dt = Math.max(1, now - game._lastT);
  game._lastT = now;
  const fps = 1000 / dt;
  game._fpsEMA = game._fpsEMA === 0 ? fps : game._fpsEMA * 0.95 + fps * 0.05;
  window.__fps = Math.round(game._fpsEMA);
}

game.step = (dt) => {
  advance(dt);
};
game.render = () => render();
game.input = input;
game.cam = cam;
game.sound = sound;
game.player = player;
game.setPlayer = setPlayer;
game.interact = interact;
game.resetRun = resetRun;
game.saveGame = saveGame;
game.loadSave = loadSave;
game.api = null; // set below

// ---- window.__game contract ----
const api = {
  get time() { return game.time; },
  get cash() { return game.cash; },
  set cash(v) { game.cash = v; },
  get save() { return game.save || null; },
  get state() { return game.state; },
  player,
  setPlayer,
  exitCar,
  tryEnterCarAt,
  resetRun,
  saveGame,
  loadSave,
  display,
  missions,
  police,
  combat,
  cam,
  town,
  scene,
  renderer,
  sound,
  get traffic() { return cars.traffic; },
  pedestrians,
  get timeScale() { return game.timeScale; },
  set timeScale(v) { game.timeScale = v; },
  get sirenActive() { return game.sirenActive; },
};
game.api = api;
window.__game = api;
window.__game._debug = { game, cars, TOTAL_CASH };

// ---- Title / start ----
function startPlaying() {
  if (game.state !== 'title') return;
  game.state = 'playing';
  const t = document.getElementById('title-screen');
  if (t) t.classList.add('hidden');
  sound.unlock();
  display.msg('Welcome to Vela Bay. Mara is waiting — mission 1 starts now.', 4000);
  missions.start(1);
  window.__trace.push('start');
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && game.state === 'title') startPlaying();
});
canvas.addEventListener('pointerdown', () => {
  if (game.state === 'title') startPlaying();
  else sound.unlock();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Main loop / autopilot / shot ----
if (isAutopilot) {
  game.state = 'playing';
  document.getElementById('title-screen')?.classList.add('hidden');
  render();
  runSelftest(game).then((results) => {
    window.__autopilotResults = results;
    const passed = results.filter((r) => r.pass).length;
    const lines = results.map((r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.name} — ${r.info}`);
    const el = document.getElementById('test-results');
    if (el) el.textContent = `${passed}/${results.length} passed\n` + lines.join('\n');
    document.title = passed === results.length ? 'AUTOPILOT-PASS' : 'AUTOPILOT-FAIL';
    window.__trace.push(`autopilot ${passed}/${results.length}`);
  }).catch((e) => {
    window.__errors.push('selftest: ' + String(e && e.message || e));
    document.title = 'AUTOPILOT-FAIL';
  });
} else if (shotParam) {
  game.state = 'playing';
  document.getElementById('title-screen')?.classList.add('hidden');
  game.frozen = true;
  poses.stage(shotParam);
  // Stage the HUD to match the shot.
  display.setStars(police.stars);
  display.setCash(game.cash);
  display.setClock(game.time, game.dayT);
  display.setHealth(player.health, player.armour);
  display.setWeapon(CFG.weapons, combat.weaponIndex, combat.ammo);
  display.setRadio(sound.currentStation());
  display.setRep(rep());
  display.setSpeed(player.car ? player.car.speed : 0, !!player.car);
  display.setDistrict(town.districtAt(player.x, player.z));
  display.setProgress(missions.completed.size, MISSIONS.length);
  const mm = document.getElementById('minimap');
  if (mm) {
    const mctx = mm.getContext('2d');
    if (mctx) display.drawMinimap(mctx, player, missions, police, town);
  }
  render();
  const loop = () => {
    render();
    requestAnimationFrame(loop);
  };
  loop();
} else {
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - game._lastT) / 1000);
    game._lastT = now;
    advance(dt);
    render();
    requestAnimationFrame(loop);
  };
  // Prime the title backdrop.
  render();
  loop();
}
