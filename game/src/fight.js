// VELA BAY — combat: pistol/SMG, enemies, tracers, armour-first damage.
// Shooting is straight along cam.yaw (the view direction).
import * as THREE from '../vendor/three.module.js';
import { CFG } from './settings.js';

export function makeCombat(scene) {
  const combat = {
    enemies: [],
    tracers: [],
    ammo: [Infinity, 120],
    weaponIndex: 0,
    _cool: 0,
    _tracerPool: [],
  };

  const enemyBodyGeo = new THREE.BoxGeometry(0.8, 1.7, 0.5);
  const enemyHeadGeo = new THREE.SphereGeometry(0.3, 8, 6);
  const jacketMat = new THREE.MeshLambertMaterial({ color: 0xc22a2a });
  const headMat = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const hatMat = new THREE.MeshLambertMaterial({ color: 0xffd23d, emissive: 0xaa8800, emissiveIntensity: 0.7 });

  combat.spawnEnemies = (n, cx, cz, radius = 12) => {
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(enemyBodyGeo, jacketMat);
      body.position.y = 0.85;
      g.add(body);
      const head = new THREE.Mesh(enemyHeadGeo, headMat);
      head.position.y = 1.95;
      g.add(head);
      const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.12, 8), hatMat);
      hat.position.y = 2.2;
      g.add(hat);
      const a = (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * radius * 0.5;
      const z = cz + Math.sin(a) * radius * 0.5;
      g.position.set(x, 0, z);
      scene.add(g);
      combat.enemies.push({
        mesh: g, x, z, hp: 100, shootCd: 1 + i * 0.5, speed: 3.0, alive: true,
      });
    }
    return combat.enemies;
  };

  combat.clearEnemies = () => {
    for (const e of combat.enemies) scene.remove(e.mesh);
    combat.enemies = [];
  };

  function makeTracer(from, to, color) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
    scene.add(line);
    combat.tracers.push({ line, life: 0.09 });
  }

  // Fire one shot along yaw from the player. Returns the enemy hit (or null).
  combat.shoot = (player, yaw) => {
    const w = CFG.weapons[combat.weaponIndex];
    if (combat._cool > 0) return 'cool';
    if (combat.ammo[combat.weaponIndex] !== Infinity) {
      if (combat.ammo[combat.weaponIndex] <= 0) return 'empty';
      combat.ammo[combat.weaponIndex]--;
    }
    combat._cool = w.rate;
    const ox = player.x;
    const oz = player.z;
    const oy = player.car ? 1.6 : 1.5;
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    const end = { x: ox + dx * w.range, y: oy, z: oz + dz * w.range };
    let hit = null;
    let best = w.range;
    for (const e of combat.enemies) {
      if (!e.alive) continue;
      const ex = e.x - ox;
      const ez = e.z - oz;
      const along = ex * dx + ez * dz;
      if (along < 0 || along > w.range) continue;
      const perp = Math.abs(ex * dz - ez * dx);
      if (perp < 1.2 && along < best) {
        best = along;
        hit = e;
      }
    }
    if (hit) {
      hit.hp -= w.dmg;
      end.x = hit.x;
      end.y = 1.2;
      end.z = hit.z;
      if (hit.hp <= 0) {
        hit.alive = false;
        hit.mesh.visible = false;
      }
    }
    makeTracer({ x: ox, y: oy, z: oz }, end, w.color);
    return hit;
  };

  // Enemy AI: walk at the player, shoot (2 dmg, armour absorbs first).
  combat.update = (dt, player, onPlayerHit) => {
    combat._cool = Math.max(0, combat._cool - dt);
    for (let i = combat.tracers.length - 1; i >= 0; i--) {
      const t = combat.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        scene.remove(t.line);
        t.line.geometry.dispose();
        combat.tracers.splice(i, 1);
      }
    }
    for (const e of combat.enemies) {
      if (!e.alive) continue;
      const dx = player.x - e.x;
      const dz = player.z - e.z;
      const d = Math.hypot(dx, dz);
      if (d > 3) {
        const h = Math.atan2(dx, dz);
        e.x += Math.sin(h) * e.speed * dt;
        e.z += Math.cos(h) * e.speed * dt;
        e.mesh.rotation.y = h;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d < 40) {
        e.shootCd = 1.6;
        makeTracer({ x: e.x, y: 1.4, z: e.z },
          { x: player.x, y: 1.3, z: player.z }, 0xff5533);
        if (onPlayerHit) onPlayerHit(CFG.enemyShotDmg);
      }
    }
  };

  combat.aliveCount = () => combat.enemies.filter((e) => e.alive).length;

  combat.resetAmmo = () => {
    combat.ammo = [Infinity, 120];
    combat.weaponIndex = 0;
  };

  return combat;
}
