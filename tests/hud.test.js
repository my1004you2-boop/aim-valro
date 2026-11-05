import { test, expect } from 'vitest';
import { speedMeter } from '../src/ui/hud.js';

test('the speed bar fills with speed and turns green inside the deadzone', () => {
  expect(speedMeter(0.8, 0.275)).toEqual({ fill: 0.8, mark: 0.275, inZone: false });
  expect(speedMeter(0.2, 0.275)).toEqual({ fill: 0.2, mark: 0.275, inZone: true });
  expect(speedMeter(0.275, 0.275).inZone).toBe(true);
  expect(speedMeter(1.4, 0.275).fill).toBe(1);
});
