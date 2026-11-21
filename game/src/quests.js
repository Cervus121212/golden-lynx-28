// VELA BAY — quests: 8 missions, $19,000 total. Steps are 1-based.
// start(i) takes the 1-based mission number (M1..M8).
import * as THREE from '../vendor/three.module.js';
import { MISSIONS, CFG } from './settings.js';

const MARA_LINES = {
  1: "Mara: Dante. You're back in Vela Bay and already broke. Take the coupe from the garage — we have work.",
  2: "Mara: A package at the docks, no questions. Rook's men are watching the cranes, so be quick.",
  3: "Mara: VBPD is on you! Lose them — duck the alleys, break line of sight, stay away from the cruisers.",
  4: "Mara: Rook set a trap at the docks. Four of his dealers. End it, take the cash, and don't get cute.",
  5: "Mara: I'm at the marina. Ninety seconds to the north fence — drive like the bay is burning!",
  6: "Mara: The green sedan circling the plaza — that's Rook's informant. Ram him off the road, get the ledger.",
  7: "Mara: A van full of casino cash is parked on the beach. Steal it, shake the tail, bring it home.",
  8: "Mara: The whole bay is watching, Dante. Survive one minute at four stars, then vanish to the yacht.",
};
const ROOK_LINES = {
  4: 'Det. Rook: You picked the wrong dock, Reyes. My boys will bury you in the sand.',
  8: 'Det. Rook: Every unit in Vela Bay is coming for you. There is nowhere left to run.',
};

export function makeQuests(ctx) {
  const { scene, cars, police, combat, display, sound, player, town } = ctx;

  const markerMat = new THREE.MeshLambertMaterial({ color: 0xffd23d, emissive: 0xaa7700, emissiveIntensity: 0.9 });
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), markerMat);
  marker.visible = false;
  scene.add(marker);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.0, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  const missions = {
    index: 0, // 1-based current mission number, 0 = none
    active: false,
    step: 1,
    completed: new Set(),
    target: null,
    chaseTarget: null,
    _timer: 0,
    _survive: 0,
    _autoNext: 0,
    _van: null,
  };

  function current() {
    return MISSIONS[missions.index - 1] || null;
  }

  function setTarget(t) {
    missions.target = t || null;
    marker.visible = !!t;
    ring.visible = !!t;
    if (t) {
      marker.position.set(t.x, 6, t.z);
      ring.position.set(t.x, 0.15, t.z);
    }
  }

  function showStep() {
    const m = current();
    if (!m || !missions.active) return;
    const s = m.steps[missions.step - 1];
    if (!s) return;
    display.msg(`${m.name} — ${s.text}`, CFG.msgMissionMs);
    if (s.at) setTarget(s.at);
    else setTarget(null);
    if (s.timer) missions._timer = s.timer;
    if (s.survive) missions._survive = s.survive;
  }

  missions.start = (i) => {
    const n = Math.round(i);
    if (n < 1 || n > MISSIONS.length) return false;
    const m = MISSIONS[n - 1];
    missions.index = n;
    missions.active = true;
    missions.step = 1;
    missions._autoNext = 0;
    missions._timer = 0;
    missions._survive = 0;
    if (MARA_LINES[n]) display.dialog('Mara Voss', MARA_LINES[n], 6000);
    if (ROOK_LINES[n]) display.dialog('Det. Rook', ROOK_LINES[n], 5000);
    if (n === 3) police.setStars(3);
    if (n === 4) {
      combat.clearEnemies();
      combat.spawnEnemies(4, 264, 120, 14);
    }
    if (n === 6) {
      const mesh = cars.spawnCarAt(110, 80, 0, 0x2a8a3a, 'sedan');
      missions.chaseTarget = {
        car: mesh, hp: 120, angle: 0, cx: 40, cz: 80, rx: 70, ry: 55, rate: 0.12, dead: false,
      };
    }
    if (n === 7) {
      missions._van = cars.spawnCarAt(-180, 232, Math.PI / 2, 0xe8e8e8, 'van');
    }
    if (n === 8) police.setStars(4);
    display.missionPanel(m);
    showStep();
    return true;
  };

  function advance() {
    const m = current();
    if (!m) return;
    missions.step++;
    if (missions.step > m.steps.length) {
      complete(m);
    } else {
      showStep();
    }
  }

  function complete(m) {
    missions.completed.add(m.id);
    missions.active = false;
    missions.index = 0;
    missions.step = 1;
    setTarget(null);
    ctx.game.cash += m.cash;
    sound.cash();
    display.msg(`MISSION PASSED — ${m.name}  +$${m.cash.toLocaleString()}`, CFG.msgPassMs);
    display.missionPanel(null);
    if (missions.chaseTarget) {
      cars.removeCar(missions.chaseTarget.car);
      missions.chaseTarget = null;
    }
    ctx.saveGame();
    if (missions.completed.size < MISSIONS.length) {
      missions._autoNext = 2.5;
    } else {
      display.dialog('Mara Voss', 'Mara: That\'s the whole bay, Dante. You are the King of Vela now.', 7000);
    }
  }

  missions.fail = (reason) => {
    const m = current();
    if (!m) return;
    sound.fail();
    display.msg(`MISSION FAILED — ${reason}`, CFG.msgPassMs);
    if (typeof window !== 'undefined' && window.__trace) window.__trace.push(`mission-fail:${m.id}`);
    missions.active = false;
    missions.index = 0;
    missions.step = 1;
    setTarget(null);
    if (missions.chaseTarget) {
      cars.removeCar(missions.chaseTarget.car);
      missions.chaseTarget = null;
    }
    combat.clearEnemies();
    police.setStars(0);
    missions._autoNext = 6;
  };

  // E pressed: mission interact beats entering a car. Only needE steps
  // consume E; plain arrival steps complete by driving there.
  missions.tryInteract = () => {
    if (!missions.active) return false;
    const m = current();
    const s = m && m.steps[missions.step - 1];
    if (!s || !s.at || !s.needE) return false;
    const px = player.car ? player.car.x : player.x;
    const pz = player.car ? player.car.z : player.z;
    const d = Math.hypot(px - s.at.x, pz - s.at.z);
    if (d > s.at.r) return false;
    if (m.id === 1 && missions.step === 1) {
      // First Wheels: taking the coupe IS the objective — get in and go.
      player.car = cars.player;
      sound.pickup();
      advance();
      return true;
    }
    if (m.id === 7 && missions.step === 1) {
      // Steal the van: player takes the van, heat goes to 3 stars.
      if (missions._van) {
        player.car = missions._van;
        player.inCar = true;
        police.setStars(3);
        sound.pickup();
        advance();
        return true;
      }
    }
    sound.pickup();
    advance();
    return true;
  };

  missions.update = (dt) => {
    // Auto-start the next mission after a pause.
    if (!missions.active && missions._autoNext > 0) {
      missions._autoNext -= dt;
      if (missions._autoNext <= 0) {
        const next = missions.completed.size + 1;
        if (next <= MISSIONS.length) missions.start(next);
      }
      return;
    }
    if (!missions.active) return;
    const m = current();
    const s = m.steps[missions.step - 1];
    if (!s) return;

    // Marker bob.
    if (missions.target) {
      marker.position.y = 6 + Math.sin(performance.now() / 300) * 0.8;
      marker.rotation.y += dt * 1.5;
    }

    const px = player.car ? player.car.x : player.x;
    const pz = player.car ? player.car.z : player.z;

    if (s.lose) {
      if (police.stars === 0) advance();
      return;
    }
    if (s.survive) {
      if (police.stars < 4) police.setStars(4, true);
      missions._survive -= dt;
      if (missions._survive <= 0) advance();
      return;
    }
    if (s.ram) {
      const t = missions.chaseTarget;
      if (t && !t.dead) {
        t.angle += t.rate * dt;
        t.car.x = t.cx + Math.cos(t.angle) * t.rx;
        t.car.z = t.cz + Math.sin(t.angle) * t.ry;
        t.car.heading = Math.atan2(
          -Math.sin(t.angle) * t.rx, Math.cos(t.angle) * t.ry);
        t.car.mesh.position.set(t.car.x, 0, t.car.z);
        t.car.mesh.rotation.y = t.car.heading;
        const pcx = player.car ? player.car.x : player.x;
        const pcz = player.car ? player.car.z : player.z;
        const d = Math.hypot(pcx - t.car.x, pcz - t.car.z);
        if (player.car && d < 7) {
          t.hp -= 120 * dt;
          if (t.hp <= 0) {
            t.dead = true;
            t.car.speed = 0;
            display.msg('Informant stopped — the ledger is yours.', CFG.msgMissionMs);
            advance();
          }
        }
      }
      return;
    }
    if (s.kill) {
      if (combat.aliveCount() === 0) advance();
      return;
    }
    if (s.at) {
      const d = Math.hypot(px - s.at.x, pz - s.at.z);
      if (s.noE) {
        if (d < s.at.r) {
          if (m.id === 5 && missions.step === 1) {
            display.dialog('Mara Voss', "Mara: Go! North fence, ninety seconds!", 4000);
          }
          advance();
        }
        return;
      }
      if (s.timer) {
        missions._timer -= dt;
        if (missions._timer <= 0) {
          missions.fail('Out of time.');
          return;
        }
        if (d < s.at.r) advance();
        return;
      }
      if (s.needE) return; // E-gated step: waits for tryInteract().
      if (d < s.at.r) advance(); // plain arrival step completes on arrival.
      return;
    }
  };

  missions.reset = () => {
    missions.index = 0;
    missions.active = false;
    missions.step = 1;
    missions.completed = new Set();
    missions.target = null;
    missions._autoNext = 0;
    missions._timer = 0;
    missions._survive = 0;
    if (missions.chaseTarget) {
      cars.removeCar(missions.chaseTarget.car);
      missions.chaseTarget = null;
    }
    if (missions._van) {
      cars.removeCar(missions._van);
      missions._van = null;
    }
    setTarget(null);
    combat.clearEnemies();
  };

  return missions;
}
