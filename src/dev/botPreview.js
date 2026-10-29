// 개발용: index.html#bot-preview 로 열면 봇 자세를 나란히 보여 준다(히트박스 와이어프레임 포함).
import * as THREE from 'three';
import { createBotModel } from '../game/botModel.js';
import { DEFAULT_SETTINGS } from '../core/settings.js';

export function startBotPreview(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a1e26');
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#303540', 1.4));
  const sun = new THREE.DirectionalLight('#ffffff', 1.2);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#3a3f4a' }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.4, 6);
  camera.lookAt(0, 1, 0);
  const poses = [
    { strafeVel: 0, crouch: 0, t: 0 },
    { strafeVel: 5.4, crouch: 0, t: 0.14 },
    { strafeVel: -5.4, crouch: 0, t: 0.3 },
    { strafeVel: 0, crouch: 1, t: 0 },
  ];
  poses.forEach((p, i) => {
    const bot = createBotModel(DEFAULT_SETTINGS.bot.colors);
    bot.root.position.x = (i - 1.5) * 1.4;
    bot.root.rotation.y = i === 3 ? 0.6 : 0;
    bot.setPose(p);
    bot.setDebug(location.search.includes('hitbox'));
    scene.add(bot.root);
  });
  renderer.render(scene, camera);
}
