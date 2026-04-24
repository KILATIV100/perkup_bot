import { useRef, useEffect, useCallback, useState } from 'react'

interface Platform {
  x: number; y: number; w: number
  type: 'normal' | 'moving' | 'breaking' | 'spring'
  dx?: number
  broken?: boolean
  springActive?: boolean
}

interface Bean { x: number; y: number; collected: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }

interface GameState {
  playerX: number; playerY: number; playerVx: number; playerVy: number
  platforms: Platform[]; beans: Bean[]; particles: Particle[]
  score: number; maxHeight: number; cameraY: number
  gameOver: boolean; started: boolean; facing: 'left' | 'right'
}

const C = {
  sky1: '#fdf6ed', sky2: '#f0d9b0',
  platform: '#6b3a2a', platformMoving: '#c8973a',
  platformBreaking: '#c4763a', platformSpring: '#2d1408',
  spring: '#e8c98a', player: '#6b3a2a',
  bean: '#c8973a', beanDark: '#6b3a2a',
  text: '#3d1c02', overlay: 'rgba(29,14,1,0.72)',
}

const GRAVITY        = 0.38
const JUMP_VEL       = -11
const SPRING_VEL     = -16
const MOVE_SPEED     = 4.5
const FRICTION       = 0.90
const PLAT_W         = 72
const PLAT_H         = 14
const PLAYER_W       = 34
const PLAYER_H       = 38

// ── КЛЮЧОВА ЛОГІКА: генерація платформ ────────────────────────────────────────
// Гарантуємо досяжність КОЖНОЇ платформи:
// 1. Вертикальний gap ≤ MAX_REACHABLE_GAP (висота стрибка)
// 2. Ламучі платформи ТІЛЬКИ якщо поруч є нормальна (≤ 90px по X)
// 3. Spring появляється рідко і НІКОЛИ не єдина на ділянці

const MAX_REACH_GAP = 100   // максимум по Y між платформами (досяжно)
const MIN_GAP       = 55    // мінімум по Y
const SPRING_RARE   = 0.07  // 7% шанс spring
const MOVING_RATE   = 0.18  // 18% шанс moving
const BREAKING_RATE = 0.18  // 18% шанс breaking (тільки якщо є нормальна поруч)

function canvasWidth() { return 0 } // placeholder, реальна W передається

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

/**
 * Генеруємо платформи так що КОЖНУ можна дістати:
 * - Gap по Y: MIN_GAP..MAX_REACH_GAP
 * - Ламуча платформа: тільки якщо є звичайна впритул (< 100px по X)
 * - Після ламучої завжди йде нормальна
 */
function generatePlatforms(fromY: number, toY: number, W: number, seed: Platform[]): Platform[] {
  const plats: Platform[] = [...seed]
  let y = fromY

  while (y > toY) {
    const gap = MIN_GAP + Math.random() * (MAX_REACH_GAP - MIN_GAP)
    y -= gap

    // Ширина: нормальні ширші, щоб простіше
    const w = PLAT_W + Math.floor(Math.random() * 20)
    const x = clamp(Math.random() * (W - w), 0, W - w)

    // Тип
    const rng = Math.random()
    let type: Platform['type'] = 'normal'

    if (rng < SPRING_RARE) {
      type = 'spring'
    } else if (rng < SPRING_RARE + MOVING_RATE) {
      type = 'moving'
    } else if (rng < SPRING_RARE + MOVING_RATE + BREAKING_RATE) {
      // Ламуча тільки якщо поруч є нормальна в межах 120px по X і ~80px по Y
      const hasNearNormal = plats.some(
        p => p.type === 'normal' && Math.abs(p.y - y) < 80 && Math.abs((p.x + p.w / 2) - (x + w / 2)) < 120
      )
      type = hasNearNormal ? 'breaking' : 'normal'
    }

    const p: Platform = { x, y, w, type }
    if (type === 'moving') p.dx = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 1.5)

    plats.push(p)
  }
  return plats
}

function spawnBeans(platforms: Platform[], existing: Bean[]): Bean[] {
  const beans = [...existing]
  for (const p of platforms) {
    if (p.type === 'breaking') continue // на ламучих немає зерен
    if (Math.random() > 0.35) continue
    const bx = p.x + p.w / 2 + (Math.random() - 0.5) * 24
    const by = p.y - 22 - Math.random() * 22
    if (!beans.some(b => Math.abs(b.x - bx) < 18 && Math.abs(b.y - by) < 18)) {
      beans.push({ x: bx, y: by, collected: false })
    }
  }
  return beans
}

interface Props { onGameOver: (score: number) => void }

export default function CoffeeJumpGame({ onGameOver }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const stateRef    = useRef<GameState | null>(null)
  const rafRef      = useRef(0)
  const keysRef     = useRef<Record<string, boolean>>({})
  const touchXRef   = useRef<number | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [gameOver, setGameOver] = useState(false)

  const initGame = useCallback((W: number, H: number) => {
    setGameOver(false)
    const groundY = H - 60
    const start: Platform[] = [
      // Широка початкова платформа — гравець точно на ній
      { x: W / 2 - 50, y: groundY, w: 100, type: 'normal' },
    ]
    const platforms = generatePlatforms(groundY - 10, groundY - H * 2.5, W, start)
    stateRef.current = {
      playerX: W / 2 - PLAYER_W / 2,
      playerY: groundY - PLAYER_H,
      playerVx: 0, playerVy: 0,
      platforms, beans: spawnBeans(platforms, []),
      particles: [], score: 0,
      maxHeight: groundY, cameraY: 0,
      gameOver: false, started: false, facing: 'right',
    }
  }, [])

  // Resize
  useEffect(() => {
    const measure = () => {
      const el = canvasRef.current?.parentElement
      if (!el) return
      const w = el.clientWidth
      // Висота: займаємо весь viewport мінус хедер (~56px)
      const h = Math.min(window.innerHeight - 56, 520)
      setSize({ w, h })
      if (!stateRef.current || stateRef.current.gameOver) initGame(w, h)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [initGame])

  // Keys
  useEffect(() => {
    const h = (e: KeyboardEvent) => { keysRef.current[e.key] = e.type === 'keydown' }
    window.addEventListener('keydown', h)
    window.addEventListener('keyup', h)
    return () => { window.removeEventListener('keydown', h); window.removeEventListener('keyup', h) }
  }, [])

  // Touch
  useEffect(() => {
    const el = canvasRef.current; if (!el) return
    const onStart = (e: TouchEvent) => {
      touchXRef.current = e.touches[0].clientX
      if (stateRef.current && !stateRef.current.started) stateRef.current.started = true
    }
    const onMove  = (e: TouchEvent) => { touchXRef.current = e.touches[0].clientX }
    const onEnd   = () => { touchXRef.current = null }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [size])

  // Tilt
  useEffect(() => {
    const h = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || !stateRef.current) return
      const t = clamp(e.gamma / 25, -1, 1)
      stateRef.current.playerVx = t * MOVE_SPEED * 2
      if (t > 0.1) stateRef.current.facing = 'right'
      else if (t < -0.1) stateRef.current.facing = 'left'
    }
    window.addEventListener('deviceorientation', h)
    return () => window.removeEventListener('deviceorientation', h)
  }, [])

  // Game loop
  useEffect(() => {
    if (!size.w || !size.h) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = size.w, H = size.h
    if (!stateRef.current) initGame(W, H)

    const loop = () => {
      const s = stateRef.current!
      rafRef.current = requestAnimationFrame(loop)

      // INPUT
      const keys = keysRef.current
      if (keys['ArrowLeft'] || keys['a']) {
        s.playerVx = -MOVE_SPEED; s.facing = 'left'
        if (!s.started) s.started = true
      } else if (keys['ArrowRight'] || keys['d']) {
        s.playerVx = MOVE_SPEED; s.facing = 'right'
        if (!s.started) s.started = true
      } else if (touchXRef.current !== null) {
        const diff = (touchXRef.current - W / 2) / (W / 2)
        s.playerVx = diff * MOVE_SPEED * 1.6
        s.facing = diff > 0.05 ? 'right' : diff < -0.05 ? 'left' : s.facing
      } else {
        s.playerVx *= FRICTION
      }

      // PHYSICS
      if (s.started && !s.gameOver) {
        s.playerVy += GRAVITY
        s.playerX += s.playerVx
        s.playerY += s.playerVy

        // Wrap
        if (s.playerX + PLAYER_W < 0) s.playerX = W
        if (s.playerX > W) s.playerX = -PLAYER_W

        // Moving platforms
        for (const p of s.platforms) {
          if (p.type === 'moving' && p.dx) {
            p.x += p.dx
            if (p.x <= 0 || p.x + p.w >= W) p.dx! *= -1
          }
        }

        // Collisions (falling only)
        if (s.playerVy > 0) {
          for (const p of s.platforms) {
            if (p.broken) continue
            const foot = s.playerY + PLAYER_H
            const prevFoot = foot - s.playerVy
            if (
              s.playerX + PLAYER_W > p.x + 4 &&
              s.playerX < p.x + p.w - 4 &&
              prevFoot <= p.y + 4 &&
              foot >= p.y
            ) {
              if (p.type === 'spring') {
                s.playerVy = SPRING_VEL
                p.springActive = true
                setTimeout(() => { if (p) p.springActive = false }, 220)
              } else if (p.type === 'breaking') {
                s.playerVy = JUMP_VEL // підкидаємо навіть з ламучої
                p.broken = true
                for (let i = 0; i < 7; i++) {
                  s.particles.push({ x: p.x + p.w / 2, y: p.y, vx: (Math.random() - .5) * 5, vy: -Math.random() * 3, life: 35, color: C.platformBreaking, size: 3 + Math.random() * 3 })
                }
              } else {
                s.playerVy = JUMP_VEL
                for (let i = 0; i < 4; i++) {
                  s.particles.push({ x: s.playerX + PLAYER_W / 2, y: foot, vx: (Math.random() - .5) * 3, vy: Math.random() * 2, life: 14, color: C.bean, size: 2 + Math.random() * 2 })
                }
              }
            }
          }
        }

        // Camera
        const threshold = H * 0.38
        if (s.playerY < s.cameraY + threshold) {
          s.cameraY -= (s.cameraY + threshold) - s.playerY
        }

        // Score
        const h = (H - 60) - s.playerY
        if (h > s.maxHeight) { s.score += Math.floor(h - s.maxHeight); s.maxHeight = h }

        // Generate above
        const topVis = s.cameraY - 300
        const highest = Math.min(...s.platforms.map(p => p.y))
        if (highest > topVis) {
          const np = generatePlatforms(highest - 10, topVis - H, W, [])
          s.platforms.push(...np)
          s.beans.push(...spawnBeans(np, []))
        }

        // Cleanup
        const bottom = s.cameraY + H + 200
        s.platforms = s.platforms.filter(p => p.y < bottom)
        s.beans = s.beans.filter(b => b.y < bottom && !b.collected)

        // Beans
        for (const b of s.beans) {
          if (b.collected) continue
          const dist = Math.hypot(s.playerX + PLAYER_W / 2 - b.x, s.playerY + PLAYER_H / 2 - b.y)
          if (dist < 22) {
            b.collected = true; s.score += 10
            for (let i = 0; i < 5; i++) {
              s.particles.push({ x: b.x, y: b.y, vx: (Math.random() - .5) * 4, vy: (Math.random() - .5) * 4, life: 22, color: C.bean, size: 2 + Math.random() * 3 })
            }
          }
        }

        // Particles
        s.particles = s.particles.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += .1; p.life--; return p.life > 0 })

        // Game over
        if (s.playerY > s.cameraY + H + 60) {
          s.gameOver = true
          setGameOver(true)
          onGameOver(s.score)
        }
      }

      // ── RENDER ──────────────────────────────────────────────────────────────
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, C.sky2); grad.addColorStop(1, C.sky1)
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)

      ctx.save(); ctx.translate(0, -s.cameraY)

      // Platforms
      for (const p of s.platforms) {
        if (p.broken) continue
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(p.x, p.y, p.w, PLAT_H, 7)
        else { ctx.rect(p.x, p.y, p.w, PLAT_H) }

        if (p.type === 'moving') ctx.fillStyle = C.platformMoving
        else if (p.type === 'breaking') {
          ctx.fillStyle = C.platformBreaking
          ctx.fill()
          ctx.setLineDash([5, 4])
          ctx.strokeStyle = '#fff4'
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.setLineDash([])
          continue
        }
        else if (p.type === 'spring') ctx.fillStyle = C.platformSpring
        else ctx.fillStyle = C.platform
        ctx.fill()

        // Type indicator
        if (p.type === 'moving') {
          ctx.fillStyle = 'rgba(255,255,255,0.3)'
          ctx.font = '9px sans-serif'; ctx.textAlign = 'center'
          ctx.fillText('➤', p.x + p.w / 2, p.y + 10)
        }

        // Spring
        if (p.type === 'spring') {
          const sx = p.x + p.w / 2, sy = p.y
          const sh = p.springActive ? -20 : -11
          ctx.strokeStyle = C.spring; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
          ctx.beginPath(); ctx.moveTo(sx, sy)
          for (let i = 0; i < 5; i++) {
            const t = (i + 1) / 5
            ctx.lineTo(sx + (i % 2 === 0 ? -7 : 7), sy + sh * t)
          }
          ctx.stroke()
        }
      }

      // Beans
      for (const b of s.beans) {
        if (b.collected) continue
        ctx.save(); ctx.translate(b.x, b.y)
        ctx.fillStyle = C.bean
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 9, 0, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = C.beanDark; ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(0, -8); ctx.bezierCurveTo(-3, -2, 3, 2, 0, 8)
        ctx.stroke()
        ctx.restore()
      }

      // Player (coffee cup)
      ctx.save()
      ctx.translate(s.playerX + PLAYER_W / 2, s.playerY + PLAYER_H / 2)
      ctx.scale(s.facing === 'left' ? -1 : 1, 1)

      ctx.fillStyle = C.player
      ctx.beginPath()
      ctx.moveTo(-13, -11); ctx.lineTo(-10, 15)
      ctx.quadraticCurveTo(0, 21, 10, 15); ctx.lineTo(13, -11)
      ctx.closePath(); ctx.fill()

      ctx.fillStyle = '#f5e6c8'
      ctx.beginPath(); ctx.ellipse(0, -11, 14, 5, 0, 0, Math.PI * 2); ctx.fill()

      // Steam (going up)
      if (s.playerVy < -3) {
        ctx.strokeStyle = 'rgba(200,180,160,0.45)'; ctx.lineWidth = 2; ctx.lineCap = 'round'
        const t = Date.now() / 250
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath()
          ctx.moveTo(i * 5, -16)
          ctx.quadraticCurveTo(i * 5 + Math.sin(t + i) * 4, -24, i * 5, -31)
          ctx.stroke()
        }
      }

      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.ellipse(-5, -4, 4, 5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.ellipse(5, -4, 4, 5, 0, 0, Math.PI * 2); ctx.fill()

      ctx.fillStyle = '#1e0e01'
      const ey = s.playerVy < 0 ? -5 : -3
      ctx.beginPath(); ctx.ellipse(-4, ey, 2, 2.5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.ellipse(6, ey, 2, 2.5, 0, 0, Math.PI * 2); ctx.fill()

      ctx.strokeStyle = C.player; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(15, 2, 7, -Math.PI / 2, Math.PI / 2, false); ctx.stroke()
      ctx.restore()

      // Particles
      for (const p of s.particles) {
        ctx.globalAlpha = p.life / 35
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.restore()

      // HUD
      ctx.fillStyle = C.text
      ctx.font = 'bold 18px Inter, system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`☕ ${s.score}`, 14, 30)

      // Start overlay
      if (!s.started) {
        ctx.fillStyle = C.overlay; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 28px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('PerkUp Runner ☕', W / 2, H / 2 - 44)
        ctx.font = '15px Inter, system-ui, sans-serif'
        ctx.fillText('Торкнись або свайпуй щоб почати', W / 2, H / 2 + 4)
        ctx.font = '12px Inter, system-ui, sans-serif'; ctx.fillStyle = C.bean
        ctx.fillText('← → або нахиляй телефон', W / 2, H / 2 + 30)
      }

      // Game over overlay
      if (s.gameOver) {
        ctx.fillStyle = C.overlay; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 26px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'
        ctx.fillText('Гра закінчена!', W / 2, H / 2 - 52)
        ctx.font = 'bold 44px Inter, system-ui, sans-serif'; ctx.fillStyle = C.bean
        ctx.fillText(`☕ ${s.score}`, W / 2, H / 2 + 4)
        ctx.font = '13px Inter, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.fillText('Натисни «Ще раз» нижче', W / 2, H / 2 + 38)
      }
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [size, initGame, onGameOver])

  const restart = () => { if (size.w) initGame(size.w, size.h) }

  return (
    <div
      className="relative w-full flex flex-col items-center select-none"
      style={{ height: size.h || 480 }}
    >
      <canvas
        ref={canvasRef}
        width={size.w}
        height={size.h}
        className="rounded-2xl border border-amber-200 shadow-md touch-none"
        style={{ width: size.w, height: size.h, display: 'block' }}
        onClick={() => {
          if (stateRef.current && !stateRef.current.started) {
            stateRef.current.started = true
          }
        }}
      />
      {gameOver && (
        <button
          onClick={restart}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-amber-800 text-white font-bold py-3 px-10 rounded-2xl shadow-xl active:scale-95 transition-transform text-base"
        >
          Ще раз 🔄
        </button>
      )}
    </div>
  )
}
