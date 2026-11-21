// VELA BAY — selftest: exactly 58 autopilot checks. Runs when ?autopilot=1.
// Drives the real game through window.__game + game.step(dt); travel is
// skipped by teleporting the player/car to the next objective — the checks
// measure mission logic, police, combat and physics, not driving distance.
import { CFG, MISSIONS } from './settings.js';

export async function runSelftest(game) {
  const results = [];
  const G = game.api; // window.__game
  const tick = async (n = 1, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) {
      game.step(dt);
      if (i % 60 === 59) {
        game.render();
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    game.render();
  };
  const check = (name, pass, info = '') => {
    results.push({ name, pass: !!pass, info: String(info) });
    return !!pass;
  };
  const yieldNow = () => new Promise((r) => setTimeout(r, 0));

  // Loop driver: outrun the cruisers on the clear perimeter streets
  // (x=-256 / z=-256 / x=192 / z=256) at full speed until doneFn() is true.
  const LOOP = [[-256, -256], [192, -256], [192, 256], [-256, 256]];
  async function loseHeat(maxSec, doneFn) {
    const steps = maxSec * 60;
    let wp = 0;
    let bd = Infinity;
    LOOP.forEach(([x, z], i) => {
      const d = Math.hypot(x - G.player.car.x, z - G.player.car.z);
      if (d < bd) { bd = d; wp = i; }
    });
    for (let s = 0; s < steps; s++) {
      if (doneFn()) return true;
      const car = G.player.car;
      if (!car) return false;
      const [tx, tz] = LOOP[wp];
      if (Math.hypot(tx - car.x, tz - car.z) < 14) wp = (wp + 1) % LOOP.length;
      const [nx2, nz2] = LOOP[wp];
      car.heading = Math.atan2(nx2 - car.x, nz2 - car.z);
      car.speed = 40;
      game.input.keys.add('KeyW');
      game.step(1 / 60);
      game.input.keys.delete('KeyW');
      if (s % 300 === 299) game.render();
      if (s % 600 === 599) await yieldNow();
    }
    return doneFn();
  }

  // ---- API contract (8) ----
  check('api: __game has all contract keys', ['time', 'cash', 'save', 'state', 'player', 'setPlayer', 'exitCar', 'tryEnterCarAt', 'resetRun', 'saveGame', 'loadSave', 'display', 'missions', 'police', 'combat', 'cam', 'town', 'scene', 'renderer', 'sound', 'traffic', 'pedestrians', 'timeScale', 'sirenActive'].every((k) => k in G), Object.keys(G).length + ' keys');
  check('api: player shape', G.player && typeof G.player.health === 'number' && typeof G.player.heading === 'number' && G.player.mesh && typeof G.player.x === 'number' && typeof G.player.z === 'number' && 'car' in G.player, `x=${G.player.x} z=${G.player.z}`);
  check('api: missions shape', G.missions && typeof G.missions.start === 'function' && G.missions.completed instanceof Set && 'chaseTarget' in G.missions, `completed is Set: ${G.missions.completed instanceof Set}`);
  check('api: police shape', G.police && Array.isArray(G.police.cars) && Array.isArray(G.police.cops) && typeof G.police.setStars === 'function' && 'heli' in G.police && typeof G.police.nearestDist === 'number', `stars=${G.police.stars}`);
  check('api: combat shape', G.combat && Array.isArray(G.combat.enemies) && Array.isArray(G.combat.tracers) && Array.isArray(G.combat.ammo) && typeof G.combat.shoot === 'function' && typeof G.combat.spawnEnemies === 'function' && typeof G.combat.clearEnemies === 'function', `weapons=${G.combat.ammo.length}`);
  check('api: cam shape', G.cam && typeof G.cam.yaw === 'number' && typeof G.cam.pitch === 'number' && typeof G.cam.yawError === 'number', `yaw=${G.cam.yaw.toFixed(2)}`);
  check('api: world surfaces', G.town && G.scene && G.renderer && G.sound && Array.isArray(G.traffic) && Array.isArray(G.pedestrians) && typeof G.timeScale === 'number' && typeof G.sirenActive === 'boolean', `traffic=${G.traffic.length} peds=${G.pedestrians.length}`);
  check('api: no errors, no failed requests', (window.__errors || []).length === 0 && (window.__failedReqs || []).length === 0, `errors=${(window.__errors || []).length}`);

  // ---- City (6) ----
  check('city: ground spans +-288', CFG.half === 288 && G.town.buildings.length >= 40, `${G.town.buildings.length} buildings`);
  check('city: building count sane', G.town.buildings.length >= 40 && G.town.buildings.length <= 120, `${G.town.buildings.length}`);
  check('city: beach zone is sand (z=280)', !G.town.isRoad(-100, 280) && G.town.districtAt(-100, 280) === 'PALM BEACH', G.town.districtAt(-100, 280));
  check('city: docks zone (x=250)', G.town.districtAt(250, 90) === 'THE DOCKS', G.town.districtAt(250, 90));
  check('city: sun disc at (-260,78,330)', G.town.sun && Math.abs(G.town.sun.position.x + 260) < 1 && Math.abs(G.town.sun.position.y - 78) < 1 && Math.abs(G.town.sun.position.z - 330) < 1, `sun=(${G.town.sun.position.x},${G.town.sun.position.y},${G.town.sun.position.z})`);
  check('city: yacht La Sirena at (60,232)', G.town.yacht && Math.abs(G.town.yacht.position.x - 60) < 1 && Math.abs(G.town.yacht.position.z - 232) < 1, `yacht=(${G.town.yacht.position.x},${G.town.yacht.position.z})`);

  // ---- Driving (7) ----
  game.resetRun();
  await tick(5);
  check('drive: spawn (-60,-150) heading PI/2', Math.abs(G.player.x + 60) < 1 && Math.abs(G.player.z + 150) < 1 && Math.abs(G.player.heading - Math.PI / 2) < 0.01, `(${G.player.x},${G.player.z}) h=${G.player.heading.toFixed(2)}`);
  game.setPlayer(CFG.garage.x, CFG.garage.z);
  await tick(2);
  G.tryEnterCarAt(CFG.garage.x, CFG.garage.z);
  await tick(2);
  check('drive: enter car at garage', !!G.player.car, G.player.car ? 'in car' : 'on foot');
  // Move onto the open street (x=-128, z=0 intersection), face south.
  game.setPlayer(-128, 0);
  G.player.car.heading = 0;
  G.player.car.speed = 0;
  game.input.keys.add('KeyW');
  await tick(120);
  const speedAfterAccel = G.player.car.speed;
  check('drive: W accelerates past 5 m/s', speedAfterAccel > 5, `speed=${speedAfterAccel.toFixed(1)}`);
  game.input.keys.delete('KeyW');
  game.input.keys.add('KeyS');
  await tick(60);
  const speedAfterBrake = G.player.car.speed;
  await tick(120);
  const speedAfterReverse = G.player.car.speed;
  game.input.keys.delete('KeyS');
  check('drive: S brakes then reverses', speedAfterBrake < speedAfterAccel && speedAfterReverse < -0.5, `${speedAfterAccel.toFixed(1)} -> ${speedAfterBrake.toFixed(1)} -> ${speedAfterReverse.toFixed(1)}`);
  game.input.keys.add('KeyW');
  await tick(600);
  check('drive: max speed capped at 42', Math.abs(G.player.car.speed) <= 42.5, `speed=${G.player.car.speed.toFixed(1)}`);
  const h0 = G.player.car.heading;
  game.input.keys.add('KeyA');
  await tick(60);
  game.input.keys.delete('KeyA');
  game.input.keys.delete('KeyW');
  check('drive: steering changes heading', Math.abs(G.player.car.heading - h0) > 0.1, `dHeading=${(G.player.car.heading - h0).toFixed(2)}`);
  // Collision: approach the first building from the west, straight at it.
  const b = G.town.buildings[0];
  const bcx = (b.minX + b.maxX) / 2;
  const bcz = (b.minZ + b.maxZ) / 2;
  G.player.car.x = b.minX - 30;
  G.player.car.z = bcz;
  G.player.car.heading = Math.PI / 2;
  G.player.car.speed = 20;
  game.input.keys.add('KeyW');
  await tick(180);
  game.input.keys.delete('KeyW');
  const inside = G.player.car.x > b.minX - 1 && G.player.car.x < b.maxX + 1 && G.player.car.z > b.minZ - 1 && G.player.car.z < b.maxZ + 1;
  const clamped = Math.abs(G.player.x) <= 300 && Math.abs(G.player.z) <= 300 && Math.abs(G.player.car.x) <= 300 && Math.abs(G.player.car.z) <= 300;
  check('drive: building collision blocks the car, position clamped +-300', !inside && clamped, `car=(${G.player.car.x.toFixed(1)},${G.player.car.z.toFixed(1)}) box x ${b.minX.toFixed(0)}..${b.maxX.toFixed(0)}`);

  // ---- Camera (3) ----
  game.setPlayer(-128, 0);
  G.player.car.heading = 0;
  G.player.car.speed = 0;
  game.cam.yaw = 0;
  await tick(30);
  const distSlow = game.cam._dist;
  const fovSlow = game.cam._fov;
  game.input.keys.add('KeyW');
  await tick(240);
  game.input.keys.delete('KeyW');
  check('camera: distance + FOV scale with speed', game.cam._dist > distSlow && game.cam._fov > fovSlow && game.cam._fov <= 70.5, `dist ${distSlow.toFixed(1)}->${game.cam._dist.toFixed(1)} fov ${fovSlow.toFixed(1)}->${game.cam._fov.toFixed(1)}`);
  game.cam.yaw = Math.PI; // look backwards on purpose
  game.input.keys.add('KeyW');
  await tick(300);
  game.input.keys.delete('KeyW');
  check('camera: yaw eases to heading (error <= 3 deg)', G.cam.yawError <= 3, `yawError=${G.cam.yawError.toFixed(2)} deg`);
  G.exitCar();
  await tick(2);
  const yawBefore = game.cam.yaw;
  await tick(180);
  check('camera: no auto-ease on foot', Math.abs(game.cam.yaw - yawBefore) < 0.001, `yaw ${yawBefore.toFixed(3)} -> ${game.cam.yaw.toFixed(3)}`);

  // ---- Missions (13) ----
  game.resetRun();
  await tick(5);
  // M1: E at the garage enters the car AND advances the mission.
  G.missions.start(1);
  await tick(5);
  game.setPlayer(CFG.garage.x, CFG.garage.z);
  await tick(2);
  game.interact();
  await tick(2);
  check('mission: M1 E prioritizes mission interact AND enters car', G.missions.step === 2 && !!G.player.car, `step=${G.missions.step} inCar=${!!G.player.car}`);
  game.setPlayer(CFG.safehouse.x, CFG.safehouse.z - 4);
  await tick(120);
  check('mission: M1 completes (+$500)', G.missions.completed.has(1) && G.cash === 500, `cash=${G.cash}`);
  // M2: docks pickup, then home.
  G.missions.start(2);
  await tick(5);
  game.setPlayer(264, 60);
  await tick(2);
  game.interact();
  await tick(2);
  game.setPlayer(CFG.safehouse.x, CFG.safehouse.z - 4);
  await tick(120);
  check('mission: M2 completes (+$800, total $1300)', G.missions.completed.has(2) && G.cash === 1300, `cash=${G.cash}`);
  // M3: lose 3 stars by outrunning the cruisers.
  G.missions.start(3);
  await tick(5);
  const m3done = await loseHeat(150, () => G.missions.completed.has(3));
  check('mission: M3 completes by losing 3 stars (+$1200, total $2500)', m3done && G.cash === 2500, `cash=${G.cash} stars=${G.police.stars}`);
  // M4: kill 4 dealers, grab the cash.
  G.missions.start(4);
  await tick(5);
  game.player.armour = 100;
  game.setPlayer(264, 100);
  await tick(5);
  const foes = [...G.combat.enemies];
  for (const e of foes) {
    for (let s = 0; s < 200 && e.alive; s++) {
      const dx = e.x - G.player.x;
      const dz = e.z - G.player.z;
      game.cam.yaw = Math.atan2(dx, dz);
      G.combat.shoot(G.player, game.cam.yaw);
      game.step(1 / 60);
    }
  }
  await tick(30);
  game.setPlayer(264, 120);
  await tick(2);
  game.interact();
  await tick(5);
  check('mission: M4 completes — 4 dealers down, cash taken (+$2000, total $4500)', G.missions.completed.has(4) && G.combat.aliveCount() === 0 && G.cash === 4500, `cash=${G.cash} alive=${G.combat.aliveCount()}`);
  // M5: auto-pickup at the marina, then the 90 s timer fails first.
  G.missions.start(5);
  await tick(5);
  game.setPlayer(60, 232);
  await tick(30);
  check('mission: M5 auto-pickup at marina (no E, step 2)', G.missions.step === 2, `step=${G.missions.step}`);
  await tick(60 * 95);
  check('mission: M5 fails after 90 s timeout', (window.__trace || []).includes('mission-fail:5') && !G.missions.completed.has(5), `trace=${(window.__trace || []).join(',')}`);
  G.missions.start(5);
  await tick(5);
  game.setPlayer(60, 232);
  await tick(30);
  game.setPlayer(-150, -232);
  await tick(60);
  check('mission: M5 completes (+$2500, total $7000)', G.missions.completed.has(5) && G.cash === 7000, `cash=${G.cash}`);
  // M6: ram the green sedan.
  G.missions.start(6);
  await tick(5);
  const sedan = G.missions.chaseTarget;
  let m6done = false;
  for (let s = 0; s < 60 * 60 && sedan && !sedan.dead; s++) {
    G.player.car.x = sedan.car.x;
    G.player.car.z = sedan.car.z;
    G.player.car.speed = 0;
    game.step(1 / 60);
    if (s % 300 === 299) game.render();
    if (G.missions.completed.has(6)) { m6done = true; break; }
    if (s % 600 === 599) await yieldNow();
  }
  check('mission: M6 ram kills the sedan (+$3000, total $10000)', m6done && G.cash === 10000, `cash=${G.cash}`);
  // M7: steal the van, lose the 3-star tail, bring it home.
  G.missions.start(7);
  await tick(5);
  game.setPlayer(-180, 232);
  await tick(2);
  game.interact();
  await tick(2);
  const vanStolen = !!G.player.car && G.player.car.kind === 'van' && G.police.stars === 3;
  const m7lost = await loseHeat(150, () => G.missions.step === 3);
  check('mission: M7 van stolen, heat lost (step 3)', vanStolen && m7lost, `van=${vanStolen} step=${G.missions.step}`);
  game.setPlayer(CFG.safehouse.x, CFG.safehouse.z - 4);
  await tick(120);
  check('mission: M7 completes (+$4000, total $14000)', G.missions.completed.has(7) && G.cash === 14000, `cash=${G.cash}`);
  // M8: survive 60 s at 4 stars, then the yacht.
  G.missions.start(8);
  await tick(5);
  G.player.health = 100;
  game.player.armour = 100;
  await tick(60 * 65);
  game.setPlayer(60, 232);
  await tick(120);
  check('mission: M8 completes — survived 60 s + yacht (+$5000, total $19000)', G.missions.completed.has(8) && G.cash === 19000, `cash=${G.cash}`);
  check('mission: all 8 done, total cash $19,000', G.missions.completed.size === 8 && G.cash === 19000, `${G.missions.completed.size}/8 cash=${G.cash}`);

  // ---- Police (7) ----
  game.resetRun();
  await tick(5);
  G.police.setStars(3);
  await tick(5);
  check('police: 3 stars spawns 5 cruisers + heli', G.police.cars.length === 5 && !!G.police.heli, `cruisers=${G.police.cars.length} heli=${!!G.police.heli}`);
  G.police.setStars(2);
  await tick(5);
  check('police: 2 stars spawns 2 foot cops, no heli', G.police.cops.length === 2 && !G.police.heli, `cops=${G.police.cops.length} heli=${!!G.police.heli}`);
  G.police.setStars(0);
  await tick(5);
  check('police: 0 stars clears all units', G.police.cars.length === 0 && G.police.cops.length === 0 && !G.police.heli, `cars=${G.police.cars.length}`);
  G.police.setStars(3);
  await tick(2);
  const heliAt3 = !!G.police.heli;
  G.police.setStars(2);
  await tick(2);
  const heliGoneAt2 = !G.police.heli;
  check('police: heli follows the 3-star rule', heliAt3 && heliGoneAt2, `heli@3=${heliAt3} heli@2=${!heliGoneAt2}`);
  G.police.setStars(4);
  await tick(5);
  check('police: roadblocks appear at 4 stars', G.police.roadblocks.length >= 1, `${G.police.roadblocks.length} roadblocks`);
  // Decay: 1 star, player far away, cruisers parked far away — star must drop.
  G.police.setStars(1);
  await tick(2);
  game.setPlayer(-280, -280);
  for (const c of G.police.cars) { c.x = 280; c.z = 280; }
  let decayed = false;
  for (let s = 0; s < 60 * 20; s++) {
    game.step(1 / 60);
    if (G.police.stars === 0) { decayed = true; break; }
  }
  check('police: wanted decays when far from cruisers', decayed, `stars=${G.police.stars}`);
  G.police.setStars(2);
  await tick(10);
  const d0 = Math.hypot(G.police.cars[0].x - G.player.x, G.police.cars[0].z - G.player.z);
  await tick(180);
  const d1 = Math.hypot(G.police.cars[0].x - G.player.x, G.police.cars[0].z - G.player.z);
  check('police: cruiser closes in, nearestDist tracks', d1 < d0 && typeof G.police.nearestDist === 'number' && G.police.nearestDist < 9999, `${d0.toFixed(0)} -> ${d1.toFixed(0)} nearest=${G.police.nearestDist.toFixed(1)}`);
  G.police.setStars(0);
  await tick(5);

  // ---- Combat (5) ----
  game.resetRun();
  await tick(5);
  G.combat.spawnEnemies(1, G.player.x + 10, G.player.z + 10, 2);
  const foe = G.combat.enemies[0];
  game.cam.yaw = Math.atan2(foe.x - G.player.x, foe.z - G.player.z);
  const hpBefore = foe.hp;
  G.combat.shoot(G.player, game.cam.yaw);
  await tick(2);
  check('combat: pistol shot hits enemy in range', foe.hp < hpBefore, `hp ${hpBefore} -> ${foe.hp}`);
  check('combat: pistol damage is 34', hpBefore - foe.hp === 34, `dmg=${hpBefore - foe.hp}`);
  await tick(30);
  G.combat.weaponIndex = 1;
  const ammoBefore = G.combat.ammo[1];
  game.cam.yaw = Math.atan2(foe.x - G.player.x, foe.z - G.player.z);
  G.combat.shoot(G.player, game.cam.yaw);
  await tick(2);
  check('combat: SMG ammo decreases', G.combat.ammo[1] === ammoBefore - 1, `${ammoBefore} -> ${G.combat.ammo[1]}`);
  for (let s = 0; s < 300 && foe.alive; s++) {
    game.cam.yaw = Math.atan2(foe.x - G.player.x, foe.z - G.player.z);
    G.combat.shoot(G.player, game.cam.yaw);
    game.step(1 / 60);
  }
  check('combat: enemy dies after enough damage', !foe.alive && G.combat.aliveCount() === 0, `alive=${G.combat.aliveCount()}`);
  G.combat.spawnEnemies(1, G.player.x + 5, G.player.z, 1);
  const hp0 = G.player.health;
  await tick(60 * 6);
  check('combat: enemy shoots the player (2 dmg per hit)', G.player.health < hp0, `hp ${hp0} -> ${G.player.health}`);
  G.combat.clearEnemies();

  // ---- Traffic / pedestrians (4) ----
  check('traffic: 14 traffic cars', G.traffic.length === 14, `${G.traffic.length}`);
  const t0 = { x: G.traffic[0].x, z: G.traffic[0].z };
  await tick(300);
  check('traffic: cars move along roads', Math.hypot(G.traffic[0].x - t0.x, G.traffic[0].z - t0.z) > 5, `moved ${Math.hypot(G.traffic[0].x - t0.x, G.traffic[0].z - t0.z).toFixed(1)} m`);
  check('pedestrians: 12 walkers', G.pedestrians.length === 12, `${G.pedestrians.length}`);
  game.setPlayer(CFG.garage.x, CFG.garage.z);
  G.tryEnterCarAt(CFG.garage.x, CFG.garage.z);
  const ped = G.pedestrians[0];
  ped.x = G.player.car.x + 3;
  ped.z = G.player.car.z;
  ped.mesh.position.set(ped.x, 0, ped.z);
  const pd0 = Math.hypot(ped.x - G.player.car.x, ped.z - G.player.car.z);
  await tick(120);
  const pd1 = Math.hypot(ped.x - G.player.car.x, ped.z - G.player.car.z);
  check('pedestrians: walker flees a car closer than 6 m', pd1 > pd0, `${pd0.toFixed(1)} -> ${pd1.toFixed(1)}`);

  // ---- Radio / save / perf (5) ----
  check('radio: 3 stations', CFG.radio.length === 3, CFG.radio.map((s) => s.name).join(', '));
  const st0 = game.sound.station;
  game.sound.nextStation();
  check('radio: next station cycles', game.sound.station === (st0 + 1) % 3, `${st0} -> ${game.sound.station}`);
  game.resetRun();
  G.cash = 1234;
  game.saveGame();
  G.cash = 0;
  game.loadSave();
  check('save: save/load roundtrip restores cash', G.cash === 1234, `cash=${G.cash}`);
  game.render();
  const calls = G.renderer.info.render.calls;
  check('perf: draw calls under 600', calls < 600, `${calls} calls`);
  const f0 = game.frames;
  game.render();
  check('perf: frames render (counter advances)', game.frames > f0, `frames ${f0} -> ${game.frames}`);

  return results;
}
