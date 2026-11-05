import { test, expect } from 'vitest';
import * as THREE from 'three';
import { buildGun } from '../src/game/gunModels.js';
import { viewmodelPose, createViewmodel } from '../src/game/viewmodel.js';
import weaponData from '../data/weapons.json';

const ids = Object.keys(weaponData.weapons);
const rest = { sinceShot: Infinity, reloadProgress: null, equip: 1, bob: 0, speed: 0 };

test('every weapon has a gun model with a muzzle, a magazine and hands', () => {
  for (const id of ids) {
    const g = buildGun(id);
    expect(g.muzzle, id).toBeInstanceOf(THREE.Object3D);
    expect(g.mag, id).toBeInstanceOf(THREE.Object3D);
    expect(g.root.getObjectByName('rightHand'), id).toBeTruthy();
    expect(g.root.getObjectByName('leftHand'), id).toBeTruthy();
    g.root.updateMatrixWorld(true);
    // 총구는 손잡이보다 앞(-Z)에 있다.
    expect(g.muzzle.getWorldPosition(new THREE.Vector3()).z, id).toBeLessThan(-0.1);
  }
});

test('long guns are longer than pistols', () => {
  const len = (id) => {
    const g = buildGun(id);
    g.root.updateMatrixWorld(true);
    return -g.muzzle.getWorldPosition(new THREE.Vector3()).z;
  };
  expect(len('vandal')).toBeGreaterThan(len('classic') * 2);
  expect(len('guardian')).toBeGreaterThan(len('spectre'));
});

test('a shot kicks the gun back and up, then it settles', () => {
  const kick = viewmodelPose({ ...rest, sinceShot: 0 });
  const calm = viewmodelPose(rest);
  expect(kick.z).toBeGreaterThan(calm.z);
  expect(kick.rx).toBeGreaterThan(calm.rx);
  expect(kick.flash).toBe(true);
  expect(calm.flash).toBe(false);
  expect(viewmodelPose({ ...rest, sinceShot: 0.5 }).z).toBeCloseTo(calm.z, 3);
});

test('reload lowers the gun and drops the magazine mid-way', () => {
  const calm = viewmodelPose(rest);
  const mid = viewmodelPose({ ...rest, reloadProgress: 0.45 });
  expect(mid.y).toBeLessThan(calm.y);
  expect(mid.magDrop).toBeGreaterThan(0.05);
  expect(viewmodelPose({ ...rest, reloadProgress: 0.95 }).magDrop).toBeCloseTo(0, 2);
});

test('equipping raises the gun from below', () => {
  expect(viewmodelPose({ ...rest, equip: 0 }).y).toBeLessThan(viewmodelPose(rest).y - 0.1);
});

test('walking bobs the gun', () => {
  const a = viewmodelPose({ ...rest, speed: 1, bob: 0.4 });
  const b = viewmodelPose({ ...rest, speed: 1, bob: 1.9 });
  expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBeGreaterThan(0.002);
});

test('switching weapons disposes the old model', () => {
  const vm = createViewmodel();
  vm.setWeapon('vandal');
  vm.setWeapon('sheriff');
  let guns = 0;
  vm.scene.traverse((o) => o.userData.role === 'gun' && guns++);
  expect(guns).toBe(1);
  vm.update(1 / 60, { now: 1, shotAt: 0.99, reloadProgress: null, speed: 0, dx: 0, dy: 0 });
  const ndc = vm.muzzleNdc();
  expect(Math.abs(ndc.x)).toBeLessThan(1.2);
  expect(ndc.y).toBeLessThan(0.2);
});

test('the knife has its own model with the blade tip forward, and never shows a muzzle flash', () => {
  const g = buildGun('knife');
  expect(g.root.getObjectByName('blade')).toBeTruthy();
  expect(g.root.getObjectByName('rightHand')).toBeTruthy();
  g.root.updateMatrixWorld(true);
  expect(g.muzzle.getWorldPosition(new THREE.Vector3()).z).toBeLessThan(-0.15);
  expect(viewmodelPose({ ...rest, sinceShot: 0, melee: true }).flash).toBe(false);
});
