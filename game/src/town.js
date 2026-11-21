// VELA BAY — town: 9x9 city, beach, docks, marina, sun, skyline.
// Ground is ONE canvas-textured plane (roads/sand/sea/docks/parks painted in).
import * as THREE from '../vendor/three.module.js';
import { CFG, DISTRICTS, BILLBOARDS } from './settings.js';

const PALETTE = {
  land: '#4d555e',
  road: '#9aa3ad',
  sand: '#dcc78f',
  sea: '#2a7a9e',
  park: '#6a9a5a',
  docks: '#96999e',
};

function facadeTexture(rng, variant) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  const bases = ['#7d6a5a', '#5a6a7d', '#8a7a6a', '#6a5a4a', '#74655a', '#5d6b5a'];
  g.fillStyle = bases[variant % bases.length];
  g.fillRect(0, 0, 128, 256);
  // Window grid.
  const cols = 4 + (variant % 3);
  const rows = 8 + (variant % 4);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng.chance(0.28);
      g.fillStyle = lit ? '#ffd97a' : '#1c2733';
      g.fillRect(10 + col * ((128 - 20) / cols) + 2, 12 + r * ((256 - 24) / rows) + 2, 14, 16);
    }
  }
  // Ground floor shopfront.
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 228, 128, 28);
  g.fillStyle = ['#ff9a3d', '#ff4d6d', '#3ddc97', '#4dc3ff', '#ffd23d', '#c77dff'][variant % 6];
  g.fillRect(8, 234, 112, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function textTexture(text, fg, bg, font = 'bold 44px Arial') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function groundTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + CFG.half) / (CFG.half * 2)) * S;
  g.fillStyle = PALETTE.land;
  g.fillRect(0, 0, S, S);
  // Parks.
  g.fillStyle = PALETTE.park;
  g.fillRect(toPx(-192), toPx(-32), toPx(-128) - toPx(-192), toPx(32) - toPx(-32));
  g.fillRect(toPx(96), toPx(-224), toPx(160) - toPx(96), toPx(-160) - toPx(-224));
  // Roads: streets at multiples of 64, width 16.
  g.fillStyle = PALETTE.road;
  for (let k = -4; k <= 4; k++) {
    const p = toPx(k * 64);
    const w = (16 / (CFG.half * 2)) * S;
    g.fillRect(0, p - w / 2, S, w);
    g.fillRect(p - w / 2, 0, w, S);
  }
  // Beach sand z>=224, docks apron x>=224.
  g.fillStyle = PALETTE.sand;
  g.fillRect(0, toPx(CFG.beachZ), S, S - toPx(CFG.beachZ));
  g.fillStyle = PALETTE.docks;
  g.fillRect(toPx(CFG.docksX), 0, S - toPx(CFG.docksX), toPx(CFG.beachZ));
  g.fillStyle = PALETTE.sand;
  g.fillRect(toPx(CFG.docksX), toPx(CFG.beachZ), S - toPx(CFG.docksX), S - toPx(CFG.beachZ));
  // Sea strip z>=296.
  g.fillStyle = PALETTE.sea;
  g.fillRect(0, toPx(CFG.seaZ), S, S - toPx(CFG.seaZ));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildTown(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);
  const town = { group, buildings: [], colliders: [], sun: null, sunHalo: null, sea: null };

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.half * 2, CFG.half * 2),
    new THREE.MeshLambertMaterial({ map: groundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  group.add(ground);

  // Sea plane beyond the sand (animated slightly in boot).
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.half * 2, 120),
    new THREE.MeshLambertMaterial({ color: 0x2a7a9e }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.05, CFG.seaZ + 60);
  group.add(sea);
  town.sea = sea;

  // Facade materials (6 variants) + roof colors (7).
  const facades = [];
  for (let v = 0; v < 6; v++) {
    facades.push(new THREE.MeshLambertMaterial({ map: facadeTexture(rng, v) }));
  }
  const roofColors = [0x8a4a3a, 0x4a5a6a, 0x6a5a3a, 0x3a5a4a, 0x7a3a4a, 0x5a4a6a, 0x9a8a6a];
  const roofMats = roofColors.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);

  // Buildings on the 7x7 normal blocks (skip beach row z=224 and docks col x=224).
  for (let bi = 0; bi < 8; bi++) {
    for (let bj = 0; bj < 8; bj++) {
      const cx = -224 + bi * 64;
      const cz = -224 + bj * 64;
      if (cz >= CFG.beachZ || cx >= CFG.docksX) continue;
      const n = rng.chance(0.55) ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const w = n === 1 ? 40 : 20;
        const d = n === 1 ? 40 : 20;
        const ox = n === 1 ? 0 : (k === 0 ? -11 : 11);
        const oz = n === 1 ? 0 : (k === 0 ? -11 : 11);
        const h = rng.range(9, 38);
        const mat = facades[rng.int(0, 5)];
        const m = new THREE.Mesh(boxGeo, mat);
        m.scale.set(w, h, d);
        m.position.set(cx + ox, h / 2, cz + oz);
        group.add(m);
        const bb = {
          minX: cx + ox - w / 2, maxX: cx + ox + w / 2,
          minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2,
        };
        town.buildings.push(bb);
        town.colliders.push(bb);
        if (rng.chance(0.35)) {
          const roof = new THREE.Mesh(boxGeo, roofMats[rng.int(0, 6)]);
          roof.scale.set(w + 1, 1.2, d + 1);
          roof.position.set(cx + ox, h + 0.6, cz + oz);
          group.add(roof);
        }
      }
    }
  }

  // Billboards facing the beach.
  for (const b of BILLBOARDS) {
    const tex = textTexture(b.text, '#ffffff', '#222233');
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(26, 7, 1),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    board.position.set(b.x, 16, b.z);
    group.add(board);
    const post = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x333333 }));
    post.scale.set(1.5, 12, 1.5);
    post.position.set(b.x, 6, b.z);
    group.add(post);
  }

  // District signs.
  for (const d of DISTRICTS) {
    const tex = textTexture(d.name, '#ffe9a8', '#1c2733', 'bold 40px Arial');
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 4.5),
      new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    sign.position.set(d.x, 5, d.z);
    sign.rotation.y = rng.range(0, Math.PI);
    group.add(sign);
  }

  // Sun disc + halo over the sea.
  const sunMat = new THREE.MeshBasicMaterial({ color: CFG.sun.dayColor, fog: false });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(CFG.sun.discR, 40), sunMat);
  sun.position.set(...CFG.sun.pos);
  sun.lookAt(0, 10, 0);
  group.add(sun);
  town.sun = sun;
  const haloMat = new THREE.MeshBasicMaterial({
    color: CFG.sun.dayColor, transparent: true, opacity: CFG.sun.haloOpacity, fog: false,
  });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(CFG.sun.haloR, 40), haloMat);
  halo.position.set(CFG.sun.pos[0], CFG.sun.pos[1], CFG.sun.pos[2] - 1);
  halo.lookAt(0, 10, 0);
  group.add(halo);
  town.sunHalo = halo;

  // Beach: umbrellas, towels, lifeguard tower, palms.
  const umbrellaCols = [0xff4d6d, 0x3ddc97, 0x4dc3ff, 0xffd23d];
  for (let i = 0; i < 4; i++) {
    const ux = -160 + i * 90 + rng.range(-8, 8);
    const uz = 282 + (i % 2) * 6;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    pole.position.set(ux, 2.5, uz);
    group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(4.5, 2, 10),
      new THREE.MeshLambertMaterial({ color: umbrellaCols[i] }));
    top.position.set(ux, 5.6, uz);
    group.add(top);
  }
  for (let i = 0; i < 6; i++) {
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6),
      new THREE.MeshLambertMaterial({ color: umbrellaCols[i % 4], side: THREE.DoubleSide }));
    towel.rotation.x = -Math.PI / 2;
    towel.position.set(-180 + i * 55, 0.08, 288 + (i % 2) * 4);
    group.add(towel);
  }
  const towerMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const tower = new THREE.Mesh(boxGeo, towerMat);
  tower.scale.set(4, 7, 4);
  tower.position.set(-80, 3.5, 288);
  group.add(tower);
  const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 2, 4),
    new THREE.MeshLambertMaterial({ color: 0xff4d6d }));
  towerRoof.position.set(-80, 8, 288);
  towerRoof.rotation.y = Math.PI / 4;
  group.add(towerRoof);

  // Palm trees along the beach and a few streets.
  const palmSpots = [];
  for (let x = -260; x <= 200; x += 46) palmSpots.push([x + rng.range(-6, 6), 272 + rng.range(-4, 8)]);
  palmSpots.push([-200, -120], [160, -160], [-160, 160], [200, 40]);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f8a4a });
  for (const [px, pz] of palmSpots) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 9, 6), trunkMat);
    trunk.position.set(px, 4.5, pz);
    group.add(trunk);
    const fronds = new THREE.Mesh(new THREE.ConeGeometry(3.4, 2.4, 7), frondMat);
    fronds.position.set(px, 10, pz);
    group.add(fronds);
  }

  // Docks: containers, floodlights, crates.
  const contCols = [0xc22a2a, 0x2a6ac2, 0x3d8a4a, 0xc2a12a];
  for (let i = 0; i < 10; i++) {
    const cont = new THREE.Mesh(boxGeo,
      new THREE.MeshLambertMaterial({ color: contCols[i % 4] }));
    const cw = 12;
    const ch = 3;
    const cd = 3;
    cont.scale.set(cw, ch, cd);
    const cx = 240 + (i % 3) * 16;
    const cz = -80 + Math.floor(i / 3) * 44;
    cont.position.set(cx, 1.5 + (i % 2) * 3.1, cz);
    cont.rotation.y = (i % 2) * 0.08;
    group.add(cont);
    town.colliders.push({
      minX: cx - cw / 2, maxX: cx + cw / 2, minZ: cz - cd / 2, maxZ: cz + cd / 2,
    });
  }
  const floodMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const floodHeadMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffcc, emissiveIntensity: 1.2 });
  const floodSpots = [[258, 126], [240, -40], [268, 40], [244, 170]];
  for (const [fx, fz] of floodSpots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 14, 6), floodMat);
    pole.position.set(fx, 7, fz);
    group.add(pole);
    const head = new THREE.Mesh(boxGeo, floodHeadMat);
    head.scale.set(2.4, 1, 1);
    head.position.set(fx, 14.2, fz);
    group.add(head);
  }

  // Marina yacht La Sirena at (60, 232).
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  hull.scale.set(6, 2.4, 16);
  hull.position.y = 1.2;
  yacht.add(hull);
  const cabin = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x2a4a6a }));
  cabin.scale.set(4, 2, 8);
  cabin.position.y = 3.2;
  yacht.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 9, 6),
    new THREE.MeshLambertMaterial({ color: 0xcccccc }));
  mast.position.y = 7;
  yacht.add(mast);
  yacht.position.set(CFG.yacht.x, 0, CFG.yacht.z);
  yacht.rotation.y = 0.3;
  group.add(yacht);
  town.yacht = yacht;

  // Collision: push a circle out of building/container AABBs.
  // A point deep inside a box exits through the NEAREST face.
  town.collide = (x, z, r) => {
    let px = x;
    let pz = z;
    for (const b of town.colliders) {
      const cx = Math.max(b.minX, Math.min(px, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
      const dx = px - cx;
      const dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 0.0001) {
          const toMinX = px - b.minX;
          const toMaxX = b.maxX - px;
          const toMinZ = pz - b.minZ;
          const toMaxZ = b.maxZ - pz;
          const m = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
          if (m === toMinX) px = b.minX - r;
          else if (m === toMaxX) px = b.maxX + r;
          else if (m === toMinZ) pz = b.minZ - r;
          else pz = b.maxZ + r;
        } else {
          const d = Math.sqrt(d2);
          px = cx + (dx / d) * r;
          pz = cz + (dz / d) * r;
        }
      }
    }
    return { x: px, z: pz };
  };

  town.isRoad = (x, z) => {
    const rx = Math.abs(((x + 32) % 64 + 64) % 64 - 32);
    const rz = Math.abs(((z + 32) % 64 + 64) % 64 - 32);
    return rx < 8 || rz < 8;
  };

  town.randomRoadPoint = (rng2) => {
    // Pick a street line (x = 64k or z = 64k) and a coordinate along it.
    // Returns the street orientation so callers can align the heading.
    const k = rng2.int(-4, 4) * 64;
    const along = rng2.range(-256, 256);
    if (rng2.chance(0.5)) return { x: k + rng2.range(-4, 4), z: along, vertical: true };
    return { x: along, z: k + rng2.range(-4, 4), vertical: false };
  };

  town.districtAt = (x, z) => {
    let best = DISTRICTS[0];
    let bd = Infinity;
    for (const d of DISTRICTS) {
      const dd = (d.x - x) ** 2 + (d.z - z) ** 2;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best.name;
  };

  return town;
}
