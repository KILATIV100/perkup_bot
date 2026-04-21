// ─── Рівні ────────────────────────────────────────────────────────
export type Level = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

export function getLevel(points: number): Level {
  if (points >= 3000) return 'Platinum'
  if (points >= 1000) return 'Gold'
  if (points >= 300)  return 'Silver'
  return 'Bronze'
}

// Відсоток від чеку по рівнях
export function getLevelPercent(level: Level): number {
  switch (level) {
    case 'Platinum': return 2.0
    case 'Gold':     return 1.5
    case 'Silver':   return 1.25
    default:         return 1.0
  }
}

// Множник для сумісності зі старим кодом
export function getLevelMultiplier(points: number): number {
  const level = getLevel(points)
  switch (level) {
    case 'Platinum': return 1.3
    case 'Gold':     return 1.2
    case 'Silver':   return 1.1
    default:         return 1.0
  }
}

// ─── Нарахування балів ───────────────────────────────────────────
// 1 бал = 10 грн (базовий Bronze)
// Silver: 1.25 бали / 10 грн
// Gold: 1.5 бали / 10 грн  
// Platinum: 2 бали / 10 грн
export function calcEarnedPoints(totalGrn: number, userPoints: number): number {
  const level = getLevel(userPoints)
  const percent = getLevelPercent(level)
  // percent% від суми чеку = кількість балів
  // 100 грн * 1% = 1 бал (Bronze)
  // 100 грн * 2% = 2 бали (Platinum)
  return Math.round(totalGrn * percent / 10)
}

// ─── Списання балів ──────────────────────────────────────────────
// 100 балів = 10 грн знижки
// Макс: 30% від суми чеку
// Мін: 50 балів (5 грн)
export const POINTS_TO_UAH_RATE = 0.1  // 1 бал = 0.1 грн = 10 коп

export function calcMaxRedeemablePoints(totalGrn: number, availablePoints: number): number {
  const maxByPercent = Math.floor(totalGrn * 0.30 / POINTS_TO_UAH_RATE) // 30% від чеку
  const minPoints = 50
  const maxPoints = Math.min(availablePoints, maxByPercent)
  return maxPoints >= minPoints ? maxPoints : 0
}

export function calcDiscountFromPoints(points: number): number {
  return Math.round(points * POINTS_TO_UAH_RATE * 100) / 100 // грн
}

// ─── Наступний рівень ────────────────────────────────────────────
export function getNextLevel(points: number): { name: Level; required: number } | null {
  if (points < 300)  return { name: 'Silver',   required: 300  }
  if (points < 1000) return { name: 'Gold',      required: 1000 }
  if (points < 3000) return { name: 'Platinum',  required: 3000 }
  return null
}
