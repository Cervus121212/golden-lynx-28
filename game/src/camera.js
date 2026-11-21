// VELA BAY — camera: chase cam. yaw is the VIEW direction (also the aim direction).
// Follows the heading only while driving and idle > 1.5 s; ease 2.2/s (1.4 when close).
import * as THREE from '../vendor/three.module.js';
import { CFG } from './settings.js';

export function makeCamera(camera) {
  const cam = {
    yaw: CFG.spawn.heading,
    pitch: 0.32,
    yawError: 0,
    _lastDragT: 10, // start idle so the camera settles behind the car
    _dist: 11,
    _fov: 62,
  };

  function angDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  cam.update = (dt, player, input, frozen) => {
    const drag = input.consumeDrag();
    if (Math.abs(drag.dx) > 0 || Math.abs(drag.dy) > 0) {
      cam.yaw -= drag.dx * 0.005;
      cam.pitch = Math.max(0.05, Math.min(1.1, cam.pitch + drag.dy * 0.003));
      cam._lastDragT = 0;
    } else {
      cam._lastDragT += dt;
    }
    const driving = !!player.car;
    const speed = driving ? Math.abs(player.car.speed) : 0;
    // Auto-ease toward the heading only while driving and idle.
    if (driving && cam._lastDragT > CFG.cam.idleDelay && !frozen) {
      const err = angDiff(player.heading, cam.yaw);
      const ease = Math.abs(err) < 0.4 ? CFG.cam.easeNear : CFG.cam.ease;
      cam.yaw += err * Math.min(1, ease * dt);
    }
    // On foot the camera never auto-eases (a staged aim stays whole).
    cam.yawError = driving ? Math.abs(angDiff(player.heading, cam.yaw)) * 180 / Math.PI : 0;

    const wantDist = CFG.cam.baseDist + speed * CFG.cam.speedDist;
    cam._dist += (wantDist - cam._dist) * Math.min(1, dt * 3);
    const wantFov = CFG.cam.fovMin + Math.min(1, speed / CFG.drive.maxSpeed) * (CFG.cam.fovMax - CFG.cam.fovMin);
    cam._fov += (wantFov - cam._fov) * Math.min(1, dt * 2);
    camera.fov = cam._fov;
    camera.updateProjectionMatrix();

    const px = player.car ? player.car.x : player.x;
    const pz = player.car ? player.car.z : player.z;
    const h = CFG.cam.height + speed * 0.02;
    const cx = px - Math.sin(cam.yaw) * cam._dist;
    const cz = pz - Math.cos(cam.yaw) * cam._dist;
    camera.position.set(cx, h, cz);
    camera.lookAt(px + Math.sin(cam.yaw) * 4, 1.6 - cam.pitch * 2, pz + Math.cos(cam.yaw) * 4);
  };

  // Fixed staged camera (used by poses / shot mode).
  cam.stage = (pos, look) => {
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(look[0], look[1], look[2]);
    camera.fov = 55;
    camera.updateProjectionMatrix();
  };

  cam.angDiff = angDiff;
  return cam;
}
