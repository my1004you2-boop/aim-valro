import * as THREE from 'three';

export function startApp(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(window.devicePixelRatio);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a1e26');
  const camera = new THREE.PerspectiveCamera(70.53, 1, 0.05, 500);
  camera.position.set(0, 1.6, 0);

  scene.add(new THREE.HemisphereLight('#dfe8ff', '#303540', 1.2));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: '#3a3f4a' }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const fpsEl = document.getElementById('fps');
  let frames = 0;
  let fpsT = performance.now();
  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
    frames++;
    const now = performance.now();
    if (now - fpsT >= 500) {
      fpsEl.textContent = `${Math.round((frames * 1000) / (now - fpsT))} FPS`;
      frames = 0;
      fpsT = now;
    }
  });
}
