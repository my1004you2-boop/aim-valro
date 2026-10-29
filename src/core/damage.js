export function damageAt(w, part, distM) {
  const band = w.damage.find((b) => distM <= b.maxRange) ?? w.damage[w.damage.length - 1];
  return band[part];
}

// 방어구가 데미지의 absorb 비율만큼 먼저 받는다.
export function applyDamage(target, dmg, armorRules) {
  const absorbed = Math.min(target.armor, dmg * armorRules.absorb);
  const hp = target.hp - (dmg - absorbed);
  return { hp: Math.max(0, hp), armor: target.armor - absorbed, killed: hp <= 0 };
}
