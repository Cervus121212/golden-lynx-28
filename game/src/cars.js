// VELA BAY — cars: player driving physics + traffic AI.
// Driving: accel 16, brake 30, reverse 9, max 42 m/s, steer 1.9, drag 0.35.
import * as THREE from '../vendor/three.module.js';
import { CFG } from './settings.js';

export function makeCarMesh(color, kind = 'sedan') {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fd8ef });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.65;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.3, -0.2);
  group.add(cabin);
  if (kind === 'van') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 2.6),
      new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
    box.position.set(0, 1.35, 0.9);
    group.add(box);
  }
  if (kind === 'cruiser') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x2244ff, emissiveIntensity: 1.5 }));
    bar.position.set(0, 1.75, -0.2);
    group.add(bar);
    group.userData.lightBar = bar;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    group.add(w);
    wheels.push(w);
  }
  group.userData.wheels = wheels;
  group.userData.kind = kind;
  return group;
}

export function makeCars(scene, town, rng) {
  const cars = {
    player: null,
    traffic: [],
    all: [],
  };

  function makeCarState(mesh, x, z, heading, color) {
    return {
      mesh, x, z, heading, speed: 0, color,
      health: 100, dead: false, kind: mesh.userData.kind || 'sedan',
    };
  }

  // Player car starts in the garage.
  const pMesh = makeCarMesh(0xd23a4a, 'sedan');
  pMesh.position.set(CFG.garage.x, 0, CFG.garage.z);
  scene.add(pMesh);
  cars.player = makeCarState(pMesh, CFG.garage.x, CFG.garage.z, Math.PI / 2, 0xd23a4a);
  cars.player.inGarage = true;
  cars.all.push(cars.player);

  const trafficColors = [0x3a6ad2, 0xd2a13a, 0x3a9a5a, 0x8a8a8a, 0xc2c2c2, 0x6a3ad2, 0xd26a3a];
  // Heading must follow the street the car spawns on, or it drives straight
  // into a building and never gets out.
  function streetHeading(p) {
    return p.vertical ? rng.pick([0, Math.PI]) : rng.pick([Math.PI / 2, -Math.PI / 2]);
  }
  for (let i = 0; i < CFG.trafficCount; i++) {
    const p = town.randomRoadPoint(rng);
    const mesh = makeCarMesh(trafficColors[i % trafficColors.length], 'sedan');
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    const t = makeCarState(mesh, p.x, p.z, streetHeading(p), trafficColors[i % trafficColors.length]);
    t.cruise = rng.range(8, 14);
    t.turnAt = 0;
    cars.traffic.push(t);
    cars.all.push(t);
  }

  function syncMesh(c) {
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    const spin = c.speed * 0.016;
    for (const w of c.mesh.userData.wheels || []) w.rotation.x += spin;
  }

  // Player driving: forward is (sin(heading), cos(heading)) in xz.
  // Drives whichever car the player is actually in (the garage sedan,
  // the M7 van, or any entered traffic car) — never a parked one.
  cars.updatePlayer = (dt, axis, town2, car = cars.player) => {
    const p = car;
    const d = CFG.drive;
    if (axis.f > 0) p.speed += d.accel * dt;
    else if (axis.f < 0) {
      if (p.speed > 0.5) p.speed -= d.brake * dt;
      else p.speed -= d.reverse * dt;
    } else {
      p.speed -= p.speed * d.drag * dt;
      if (Math.abs(p.speed) < 0.05) p.speed = 0;
    }
    p.speed = Math.max(-d.reverse * 1.4, Math.min(d.maxSpeed, p.speed));
    const dir = p.speed >= 0 ? 1 : -1;
    p.heading += axis.s * d.steer * dt * dir * Math.min(1, Math.abs(p.speed) / 8 + 0.25);
    let nx = p.x + Math.sin(p.heading) * p.speed * dt;
    let nz = p.z + Math.cos(p.heading) * p.speed * dt;
    const fixed = town2.collide(nx, nz, 1.6);
    // Hard hit only when the car barely moves (head-on); sliding along a
    // wall keeps most of its speed.
    const moved = Math.hypot(fixed.x - p.x, fixed.z - p.z);
    const expected = Math.abs(p.speed) * dt;
    if (expected > 0.01 && moved < expected * 0.3) p.speed *= 0.5;
    nx = fixed.x;
    nz = fixed.z;
    p.x = Math.max(-CFG.clamp, Math.min(CFG.clamp, nx));
    p.z = Math.max(-CFG.clamp, Math.min(CFG.clamp, nz));
    syncMesh(p);
    return p;
  };

  // Traffic: follow the road grid, turn at intersections, respawn elsewhere.
  cars.updateTraffic = (dt, town2) => {
    for (const t of cars.traffic) {
      if (t.dead) continue;
      const ox = t.x;
      const oz = t.z;
      const onXRoad = Math.abs(((t.z + 32) % 64 + 64) % 64 - 32) < 8;
      const onZRoad = Math.abs(((t.x + 32) % 64 + 64) % 64 - 32) < 8;
      if (onXRoad && onZRoad && Math.random() < dt * 0.5) {
        // At an intersection: sometimes turn 90 degrees.
        const turn = [-Math.PI / 2, Math.PI / 2][Math.floor(Math.random() * 2)];
        t.heading += turn;
      }
      let nx = t.x + Math.sin(t.heading) * t.cruise * dt;
      let nz = t.z + Math.cos(t.heading) * t.cruise * dt;
      // Snap back onto the road if drifting off (roads are 16 wide).
      const fixed = town2.collide(nx, nz, 1.6);
      nx = fixed.x;
      nz = fixed.z;
      if (nx > CFG.clamp || nx < -CFG.clamp || nz > CFG.clamp || nz < -CFG.clamp ||
          (!town2.isRoad(nx, nz) && Math.random() < dt * 0.2)) {
        const p = town2.randomRoadPoint(rng);
        t.x = p.x;
        t.z = p.z;
        t.heading = p.vertical ? rng.pick([0, Math.PI]) : rng.pick([Math.PI / 2, -Math.PI / 2]);
      } else {
        t.x = nx;
        t.z = nz;
      }
      // Stuck recovery: a car wedged against a building reverses out
      // along the road it came from; if it still cannot move, it
      // respawns on a fresh road point instead of sitting there forever.
      const moved = Math.hypot(t.x - ox, t.z - oz);
      t._movedAcc = (t._movedAcc || 0) + moved;
      if (t._movedAcc > 5) {
        t._movedAcc = 0;
        t._stuck = 0;
      } else {
        t._stuck = (t._stuck || 0) + 1;
        if (t._stuck === 180) {
          t.heading += Math.PI;
        } else if (t._stuck >= 360) {
          const p = town2.randomRoadPoint(rng);
          t.x = p.x;
          t.z = p.z;
          t.heading = p.vertical ? rng.pick([0, Math.PI]) : rng.pick([Math.PI / 2, -Math.PI / 2]);
          t._stuck = 0;
          t._movedAcc = 0;
        }
      }
      syncMesh(t);
    }
  };

  cars.spawnCarAt = (x, z, heading, color, kind = 'sedan') => {
    const mesh = makeCarMesh(color, kind);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const c = makeCarState(mesh, x, z, heading, color);
    cars.all.push(c);
    syncMesh(c);
    return c;
  };

  cars.removeCar = (c) => {
    scene.remove(c.mesh);
    cars.all = cars.all.filter((a) => a !== c);
    cars.traffic = cars.traffic.filter((a) => a !== c);
  };

  cars.syncAll = () => {
    for (const c of cars.all) syncMesh(c);
  };

  return cars;
}
