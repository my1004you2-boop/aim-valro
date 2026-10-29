// 발로란트 회전 공식: 회전(도) = 마우스 카운트 × 0.07 × 감도
export const VALORANT_YAW = 0.07;

export function degreesPerCount(sens) {
  return VALORANT_YAW * sens;
}

export function cmPer360(dpi, sens) {
  const counts = 360 / degreesPerCount(sens);
  return (counts / dpi) * 2.54;
}
