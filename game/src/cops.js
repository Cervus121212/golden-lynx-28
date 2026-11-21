// VELA BAY — police: wanted stars, VBPD dispatch, cruisers, foot cops, Air One heli.
// Decay counts cruiser/foot-cop distance ONLY (heli never counts).
import * as THREE from '../vendor/three.module.js';
import { CFG } from './settings.js';
import { makeCarMesh } from './cars.js';

const UNIT_NAMES = ['Unit 12', 'Unit 7', 'Unit 23', 'Unit 4', 'Unit 31', 'Unit 9', 'Unit 18'];
const DISPATCH_LINES = [
  'Dispatch: all units, suspect last seen in {d}.',
  'Air One is overhead, eyes on the suspect.',
  'Unit {u}: rolling a roadblock on the north road.',
  'Dispatch: suspect vehicle is a {c} sedan, repeat, {c} sedan.',
  'All units: use caution, suspect is armed.',
];

export function makePolice(scene, town, rng) {
  const police = {
    stars: 0,
    cars: [],
    cops: [],
    heli: null,
    roadblocks: [],
    nearestDist: 9999,
    decayTimer: 0,
    _dispatchTimer: 0,
    _unitCounter: 0,
    lastDispatch: '',
  };

  const copGeo = new THREE.BoxGeometry(0.7, 1.8, 0.5);
  const copMat = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const copHeadGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const copHeadMat = new THREE.MeshLambertMaterial({ color: 0xd9a986 });

  function makeFootCop(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(copGeo, copMat);
    body.position.y = 0.9;
    g.add(body);
    const head = new THREE.Mesh(copHeadGeo, copHeadMat);
    head.position.y = 2.0;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.15, 8),
      new THREE.MeshLambertMaterial({ color: 0x0a1a3a }));
    cap.position.y = 2.25;
    g.add(cap);
    g.position.set(x, 0, z);
    scene.add(g);
    return { mesh: g, x, z, heading: 0, speed: 3.4, shootCd: 0 };
  }

  function makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 4.5),
      new THREE.MeshLambertMaterial({ color: 0x223344 }));
    body.position.y = 0;
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.5),
      new THREE.MeshLambertMaterial({ color: 0x223344 }));
    tail.position.set(0, 0.2, -3.6);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 0.9;
    g.add(rotor);
    const spot = new THREE.Mesh(new THREE.CircleGeometry(6, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
    spot.rotation.x = -Math.PI / 2;
    spot.position.y = -20;
    g.add(spot);
    g.userData.rotor = rotor;
    scene.add(g);
    return { mesh: g, x: 0, z: 0, angle: 0, altitude: 34 };
  }

  function makeRoadblock(x, z, heading) {
    const g = new THREE.Group();
    const barMat = new THREE.MeshLambertMaterial({ color: 0xff5533, emissive: 0x881100, emissiveIntensity: 0.6 });
    for (let i = -1; i <= 1; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 5),
        barMat);
      bar.position.set(i * 5.4, 0.55, 0);
      g.add(bar);
    }
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    scene.add(g);
    return { mesh: g, x, z };
  }

  police.setStars = (n, silent = false) => {
    const next = Math.max(0, Math.min(5, Math.round(n)));
    if (next === police.stars) return;
    police.stars = next;
    police.decayTimer = 0;
    if (!silent && next > 0) {
      police.lastDispatch = DISPATCH_LINES[police._unitCounter % DISPATCH_LINES.length]
        .replace('{u}', UNIT_NAMES[police._unitCounter % UNIT_NAMES.length])
        .replace('{d}', 'the bay')
        .replace('{c}', 'red');
      police._unitCounter++;
    }
    police.syncUnits();
  };

  police.syncUnits = () => {
    const wantCruisers = police.stars === 0 ? 0 : Math.min(2 + police.stars, 7);
    const wantCops = police.stars >= 2 ? Math.min(police.stars, 4) : 0;
    while (police.cars.length < wantCruisers) {
      const a = rng.range(0, Math.PI * 2);
      const x = Math.max(-260, Math.min(260, rng.range(-200, 200)));
      const z = Math.max(-260, Math.min(260, rng.range(-200, 200)));
      const mesh = makeCarMesh(0x1a2a4a, 'cruiser');
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      const c = {
        mesh, x, z, heading: a, speed: 0, unit: UNIT_NAMES[police.cars.length % UNIT_NAMES.length],
      };
      police.cars.push(c);
    }
    while (police.cars.length > wantCruisers) {
      const c = police.cars.pop();
      scene.remove(c.mesh);
    }
    while (police.cops.length < wantCops) {
      const x = rng.range(-200, 200);
      const z = rng.range(-200, 200);
      police.cops.push(makeFootCop(x, z));
    }
    while (police.cops.length > wantCops) {
      const c = police.cops.pop();
      scene.remove(c.mesh);
    }
    if (police.stars >= 3 && !police.heli) police.heli = makeHeli();
    if (police.stars < 3 && police.heli) {
      scene.remove(police.heli.mesh);
      police.heli = null;
    }
    if (police.stars >= 4 && police.roadblocks.length === 0) {
      const a = rng.range(0, Math.PI * 2);
      police.roadblocks.push(makeRoadblock(60, -120, a));
      police.roadblocks.push(makeRoadblock(-140, 120, a + Math.PI / 2));
    }
    if (police.stars < 4) {
      for (const r of police.roadblocks) scene.remove(r.mesh);
      police.roadblocks = [];
    }
  };

  police.update = (dt, player, frozen) => {
    if (frozen) return;
    let nearest = 9999;
    // Cruisers chase the player (or the player car).
    for (const c of police.cars) {
      const tx = player.car ? player.car.x : player.x;
      const tz = player.car ? player.car.z : player.z;
      const dx = tx - c.x;
      const dz = tz - c.z;
      const d = Math.hypot(dx, dz);
      if (d < nearest) nearest = d;
      const want = Math.atan2(dx, dz);
      let diff = want - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const target = d > 6 ? 26 : 12;
      c.speed += (target - c.speed) * Math.min(1, dt * 0.8);
      let nx = c.x + Math.sin(c.heading) * c.speed * dt;
      let nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const fixed = town.collide(nx, nz, 1.6);
      c.x = Math.max(-CFG.clamp, Math.min(CFG.clamp, fixed.x));
      c.z = Math.max(-CFG.clamp, Math.min(CFG.clamp, fixed.z));
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      if (c.mesh.userData.lightBar) {
        c.mesh.userData.lightBar.material.emissive.setHex(
          Math.floor(performance.now() / 350) % 2 === 0 ? 0x2244ff : 0xff2222);
      }
    }
    // Foot cops chase on foot.
    for (const c of police.cops) {
      const dx = player.x - c.x;
      const dz = player.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < nearest) nearest = d;
      if (d > 2) {
        c.heading = Math.atan2(dx, dz);
        c.x += Math.sin(c.heading) * c.speed * dt;
        c.z += Math.cos(c.heading) * c.speed * dt;
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    }
    // Air One orbits above the player (dt-driven 0.35 rad/s).
    if (police.heli) {
      const h = police.heli;
      h.angle += 0.35 * dt;
      const tx = player.car ? player.car.x : player.x;
      const tz = player.car ? player.car.z : player.z;
      h.x = tx + Math.cos(h.angle) * 26;
      h.z = tz + Math.sin(h.angle) * 26;
      h.mesh.position.set(h.x, h.altitude, h.z);
      h.mesh.rotation.y = -h.angle;
      h.mesh.userData.rotor.rotation.y += dt * 22;
    }
    police.nearestDist = nearest;
    // Wanted decay: only cruiser/foot-cop distance counts (heli never counts).
    // A brief pass costs progress instead of wiping it — the timer drains
    // while a unit is close and builds while the player is clear.
    if (police.stars > 0) {
      if (nearest > 50) {
        police.decayTimer += dt;
        if (police.decayTimer >= 6) {
          police.decayTimer = 0;
          police.setStars(police.stars - 1);
        }
      } else {
        police.decayTimer = Math.max(0, police.decayTimer - dt);
      }
    }
    // Dispatch chatter every ~25 s while wanted.
    if (police.stars > 0) {
      police._dispatchTimer += dt;
      if (police._dispatchTimer > 25) {
        police._dispatchTimer = 0;
        police.setStars(police.stars, true);
        police.lastDispatch = DISPATCH_LINES[police._unitCounter % DISPATCH_LINES.length]
          .replace('{u}', UNIT_NAMES[police._unitCounter % UNIT_NAMES.length])
          .replace('{d}', town.districtAt(player.x, player.z))
          .replace('{c}', 'red');
        police._unitCounter++;
      }
    }
  };

  police.clearAll = () => {
    for (const c of police.cars) scene.remove(c.mesh);
    for (const c of police.cops) scene.remove(c.mesh);
    if (police.heli) scene.remove(police.heli.mesh);
    for (const r of police.roadblocks) scene.remove(r.mesh);
    police.cars = [];
    police.cops = [];
    police.heli = null;
    police.roadblocks = [];
    police.stars = 0;
    police.nearestDist = 9999;
  };

  return police;
}
