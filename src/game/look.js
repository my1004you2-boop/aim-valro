import { degreesPerCount } from '../core/sensitivity.js';

const PITCH_LIMIT = (89 * Math.PI) / 180;

export function createLook({ sens }) {
  const look = {
    yaw: 0,
    pitch: 0,
    sens,
    applyMouse(dx, dy, locked) {
      if (!locked) return;
      const k = (degreesPerCount(look.sens) * Math.PI) / 180;
      look.yaw -= dx * k;
      look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, look.pitch - dy * k));
    },
    forward() {
      const cp = Math.cos(look.pitch);
      return { x: -Math.sin(look.yaw) * cp, y: Math.sin(look.pitch), z: -Math.cos(look.yaw) * cp };
    },
  };
  return look;
}
