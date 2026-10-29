const BASE_ASPECT = 16 / 9;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

// 16:9 이상은 가로 FOV 기준, 더 좁은 화면은 16:9의 세로 FOV를 유지한다.
export function verticalFovDeg(hfovDeg, aspect) {
  const a = Math.max(aspect, BASE_ASPECT);
  return deg(2 * Math.atan(Math.tan(rad(hfovDeg) / 2) / a));
}
