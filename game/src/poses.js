// VELA BAY — poses: staged screenshots for ?shot=cover|chase|mission|title.
// Shot mode freezes police + the player car and sets document.title = 'SHOT-READY'.
import { CFG } from './settings.js';

export function makePoses(ctx) {
  const { scene, camera, cam, cars, police, town, display, player } = ctx;

  const poses = {
    staged: null,
  };

  function freezeWorld() {
    // Park cruisers + player car for a clean frame.
    police.cars.forEach((c, i) => {
      const spots = [[8, 50], [16, 54], [-14, 78], [24, 40], [-6, 64], [30, 62], [2, 44]];
      const s = spots[i % spots.length];
      c.x = s[0];
      c.z = s[1];
      c.heading = Math.PI / 2;
      c.speed = 0;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
    });
    if (player.car) {
      player.car.x = 2;
      player.car.z = 62;
      player.car.heading = Math.PI / 2;
      player.car.speed = 0;
      player.car.mesh.position.set(2, 0, 62);
      player.car.mesh.rotation.y = Math.PI / 2;
    }
    player.x = 2;
    player.z = 58;
    player.heading = Math.PI / 2;
    if (player.mesh) player.mesh.position.set(2, 0, 58);
  }

  poses.stage = (name) => {
    poses.staged = name;
    if (name === 'cover') {
      // Hero: the red sedan on the beach road at dusk, sun + skyline behind.
      police.setStars(0);
      const sedan = cars.player;
      sedan.x = -40;
      sedan.z = 244;
      sedan.heading = Math.PI / 2;
      sedan.speed = 0;
      sedan.mesh.position.set(-40, 0, 244);
      sedan.mesh.rotation.y = Math.PI / 2;
      player.car = sedan;
      player.x = -40;
      player.z = 240;
      player.heading = Math.PI / 2;
      cam.stage([-62, 3.5, 228], [-20, 2, 252]);
      display.msg('VELA BAY — the bay is yours.', 5000);
    } else if (name === 'chase') {
      // F3 pose: chase cam ~20 m, cruisers staged, heli low.
      police.setStars(3);
      freezeWorld();
      if (police.heli) {
        police.heli.mesh.position.set(27.5, 22, 44);
        police.heli.mesh.rotation.y = 2.2;
      }
      cam.stage([-19.4, 5, 58], [2, 3, 66]);
      display.msg('VBPD pursuit — 3 stars. Lose them.', 5000);
    } else if (name === 'mission') {
      // F8 pose: docks deal, camera ~28 m, dialog docked bottom-left.
      police.setStars(0);
      player.x = 250;
      player.z = 108;
      player.heading = -Math.PI / 2;
      if (player.mesh) player.mesh.position.set(250, 0, 108);
      cam.stage([244, 8, 100], [264, 2, 120]);
      display.dialog('Mara Voss', 'Mara: Four of Rook\'s men at the docks. End it, take the cash.', 8000);
      const dlg = document.getElementById('dialog');
      if (dlg) dlg.classList.add('shot-mission');
    } else if (name === 'title') {
      // Title: wide sunset over the marina + yacht.
      police.setStars(0);
      cam.stage([-40, 14, 170], [60, 4, 260]);
      display.msg('VELA BAY', 8000);
    } else if (name === 'start') {
      poses.stage('title');
      return;
    } else if (name === 'play') {
      poses.stage('chase');
      return;
    } else if (name === 'end') {
      poses.stage('mission');
      return;
    }
    document.title = 'SHOT-READY';
  };

  return poses;
}
