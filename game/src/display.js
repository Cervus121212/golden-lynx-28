// VELA BAY — display: HUD, minimap, mission panel, portrait dialog, messages.
import { CFG, MISSIONS } from './settings.js';

const MAP_COLORS = {
  land: '#4d555e',
  road: '#9aa3ad',
  sand: '#dcc78f',
  sea: '#2a7a9e',
  park: '#6a9a5a',
  docks: '#96999e',
};

export function makeDisplay(doc) {
  const el = (id) => doc.getElementById(id);
  const display = {
    _msgTimer: null,
    _dialogTimer: null,
  };

  display.msg = (text, ms = CFG.msgMs) => {
    const m = el('msg');
    if (!m) return;
    m.textContent = text;
    m.classList.add('show');
    clearTimeout(display._msgTimer);
    display._msgTimer = setTimeout(() => m.classList.remove('show'), ms);
  };

  display.dialog = (name, text, ms = 5000) => {
    const d = el('dialog');
    if (!d) return;
    const who = el('dialog-name');
    const what = el('dialog-text');
    const face = el('dialog-face');
    if (who) who.textContent = name;
    if (what) what.textContent = text;
    if (face) {
      face.textContent = name.split(' ').map((w) => w[0]).join('');
      face.style.background = name.includes('Rook')
        ? 'linear-gradient(135deg,#2a3a5a,#101828)'
        : 'linear-gradient(135deg,#ff4d6d,#7a1f3d)';
    }
    d.classList.add('show');
    clearTimeout(display._dialogTimer);
    display._dialogTimer = setTimeout(() => d.classList.remove('show'), ms);
  };

  display.missionPanel = (m) => {
    const p = el('mission-panel');
    if (!p) return;
    if (!m) {
      p.innerHTML = '<div class="mp-title">VELA BAY</div><div class="mp-next">No active mission — the bay is yours.</div>';
      return;
    }
    p.innerHTML = `<div class="mp-chapter">${m.chapter}</div>` +
      `<div class="mp-title">${m.id}. ${m.name} — $${m.cash.toLocaleString()}</div>` +
      `<div class="mp-next">NEXT: ${m.brief}</div>`;
  };

  display.setStars = (n) => {
    const s = el('stars');
    if (!s) return;
    s.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    s.classList.toggle('hot', n > 0);
  };

  display.setCash = (cash) => {
    const c = el('cash');
    if (c) c.textContent = '$' + Math.floor(cash).toLocaleString();
  };

  display.setClock = (minutes, dayT) => {
    const c = el('clock');
    if (!c) return;
    const total = Math.floor(minutes);
    const hh = Math.floor(total / 60) % 24;
    const mm = total % 60;
    const phase = dayT < 0.5 ? 'DAY' : 'DUSK';
    c.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${phase}`;
  };

  display.setHealth = (health, armour) => {
    const h = el('health-bar');
    const a = el('armour-bar');
    if (h) h.style.width = Math.max(0, health) + '%';
    if (a) a.style.width = Math.max(0, armour) + '%';
    const ht = el('health-text');
    if (ht) ht.textContent = `${Math.ceil(health)} HP`;
  };

  display.setWeapon = (weapons, idx, ammo) => {
    const w = el('weapons');
    if (!w) return;
    w.innerHTML = weapons.map((wp, i) => {
      const am = ammo[i] === Infinity ? '∞' : ammo[i];
      return `<span class="wslot${i === idx ? ' active' : ''}">${wp.short} ${am}</span>`;
    }).join('');
  };

  display.setRadio = (station) => {
    const r = el('radio');
    if (!r) return;
    r.textContent = `${station.name} · ${station.dj} — “${station.track}”`;
  };

  display.setRep = (rep) => {
    const r = el('rep');
    if (!r) return;
    let rank = CFG.ranks[0].name;
    for (const rk of CFG.ranks) if (rep >= rk.at) rank = rk.name;
    r.textContent = `${rank} · REP ${Math.floor(rep)}`;
  };

  display.setSpeed = (speed, inCar) => {
    const s = el('speed');
    if (!s) return;
    s.textContent = inCar ? `${Math.round(Math.abs(speed) * 3.6)} km/h` : 'ON FOOT';
  };

  display.setDistrict = (name) => {
    const d = el('district');
    if (d) d.textContent = name;
  };

  // Minimap: 190px, bright palette, markers S/G/Y/!, player arrow.
  display.drawMinimap = (ctx2d, player, missions, police, town) => {
    const S = 190;
    const toPx = (v) => ((v + CFG.half) / (CFG.half * 2)) * S;
    ctx2d.fillStyle = MAP_COLORS.land;
    ctx2d.fillRect(0, 0, S, S);
    ctx2d.fillStyle = MAP_COLORS.park;
    ctx2d.fillRect(toPx(-192), toPx(-32), toPx(-128) - toPx(-192), toPx(32) - toPx(-32));
    ctx2d.fillRect(toPx(96), toPx(-224), toPx(160) - toPx(96), toPx(-160) - toPx(-224));
    ctx2d.fillStyle = MAP_COLORS.road;
    for (let k = -4; k <= 4; k++) {
      const p = toPx(k * 64);
      const w = (16 / (CFG.half * 2)) * S;
      ctx2d.fillRect(0, p - w / 2, S, w);
      ctx2d.fillRect(p - w / 2, 0, w, S);
    }
    ctx2d.fillStyle = MAP_COLORS.sand;
    ctx2d.fillRect(0, toPx(CFG.beachZ), S, S - toPx(CFG.beachZ));
    ctx2d.fillStyle = MAP_COLORS.docks;
    ctx2d.fillRect(toPx(CFG.docksX), 0, S - toPx(CFG.docksX), toPx(CFG.beachZ));
    ctx2d.fillStyle = MAP_COLORS.sea;
    ctx2d.fillRect(0, toPx(CFG.seaZ), S, S - toPx(CFG.seaZ));

    function dot(x, z, color, label) {
      ctx2d.fillStyle = color;
      ctx2d.beginPath();
      ctx2d.arc(toPx(x), toPx(z), 5, 0, Math.PI * 2);
      ctx2d.fill();
      ctx2d.fillStyle = '#111';
      ctx2d.font = 'bold 8px Arial';
      ctx2d.textAlign = 'center';
      ctx2d.textBaseline = 'middle';
      ctx2d.fillText(label, toPx(x), toPx(z));
    }
    // S = safehouse, G = garage, Y = yacht, ! = mission target.
    dot(CFG.safehouse.x, CFG.safehouse.z, '#3ddc97', 'S');
    dot(CFG.garage.x, CFG.garage.z, '#4dc3ff', 'G');
    dot(CFG.yacht.x, CFG.yacht.z, '#ffd23d', 'Y');
    if (missions.target) dot(missions.target.x, missions.target.z, '#ff5533', '!');
    // Police blips.
    ctx2d.fillStyle = '#2244ff';
    for (const c of police.cars) {
      ctx2d.beginPath();
      ctx2d.arc(toPx(c.x), toPx(c.z), 2.5, 0, Math.PI * 2);
      ctx2d.fill();
    }
    // Player arrow: white triangle pointing down, rotated -heading.
    const px = toPx(player.x);
    const pz = toPx(player.z);
    ctx2d.save();
    ctx2d.translate(px, pz);
    ctx2d.rotate(-player.heading + Math.PI);
    ctx2d.fillStyle = '#ffffff';
    ctx2d.beginPath();
    ctx2d.moveTo(0, -7);
    ctx2d.lineTo(5, 6);
    ctx2d.lineTo(-5, 6);
    ctx2d.closePath();
    ctx2d.fill();
    ctx2d.restore();
  };

  display.setProgress = (done, total) => {
    const p = el('progress');
    if (p) p.textContent = `MISSIONS ${done}/${total}`;
  };

  return display;
}
