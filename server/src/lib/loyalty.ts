export function getLevelMultiplier(points: number): number {
  if (points >= 3000) return 1.3
  if (points >= 1000) return 1.2
  if (points >= 300) return 1.1
  return 1.0
}

export function calcEarnedPoints(total: number, userPoints: number): number {
  const base = Math.floor(total / 5)
  const multiplier = getLevelMultiplier(userPoints)
  return Math.round(base * multiplier)
}
