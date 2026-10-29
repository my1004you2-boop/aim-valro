// dir 주변 반각 halfAngleDeg 원뿔 안에서 균일(원판 기준)하게 방향을 뽑는다.
export function sampleSpread(dir, halfAngleDeg, rng) {
  if (halfAngleDeg <= 0) return { ...dir };
  const theta = ((halfAngleDeg * Math.PI) / 180) * Math.sqrt(rng());
  const phi = 2 * Math.PI * rng();
  // dir에 수직인 두 축 u, v
  const helper = Math.abs(dir.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let u = { x: dir.y * helper.z - dir.z * helper.y, y: dir.z * helper.x - dir.x * helper.z, z: dir.x * helper.y - dir.y * helper.x };
  const ul = Math.hypot(u.x, u.y, u.z);
  u = { x: u.x / ul, y: u.y / ul, z: u.z / ul };
  const v = { x: dir.y * u.z - dir.z * u.y, y: dir.z * u.x - dir.x * u.z, z: dir.x * u.y - dir.y * u.x };
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  const out = {
    x: dir.x * c + (u.x * Math.cos(phi) + v.x * Math.sin(phi)) * s,
    y: dir.y * c + (u.y * Math.cos(phi) + v.y * Math.sin(phi)) * s,
    z: dir.z * c + (u.z * Math.cos(phi) + v.z * Math.sin(phi)) * s,
  };
  const l = Math.hypot(out.x, out.y, out.z);
  return { x: out.x / l, y: out.y / l, z: out.z / l };
}
