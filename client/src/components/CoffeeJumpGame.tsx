import { useRef, useEffect, useCallback, useState } from 'react'

// ---------- TYPES ----------
interface Platform {
  x: number
  y: number
  w: number
  type: 'normal' | 'moving' | 'breaking' | 'spring'
  dx?: number          // moving platform speed
  broken?: boolean     // breaking platform state
  springActive?: boolean
}

interface Bean {
  x: number
  y: number
  collected: boolean
}

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number
}

interface GameState {
  playerX: number
  playerY: number
  playerVx: number
  playerVy: number
  playerW: number
  playerH: number
  platforms: Platform[]
  beans: Bean[]
  particles: Particle[]
  score: number
  maxHeight: number
  cameraY: number
  gameOver: boolean
  started: boolean
  facing: 'left' | 'right'
}

// ---------- COLORS ----------
const C = {
  sky1: '#fdf6ed',
  sky2: '#f5e6c8',
  platform: '#6b3a2a',
  platformMoving: '#c8973a',
  platformBreaking: '#d9a84e',
  platformSpring: '#3d1c02',
  spring: '#e8c98a',
  player: '#6b3a2a',
  playerEye: '#fff',
  playerPupil: '#1e0e01',
  bean: '#c8973a',
  beanDark: '#6b3a2a',
  text: '#3d1c02',
  overlay: 'rgba(29,14,1,0.65)',
}

// ---------- CONSTANTS ----------
const GRAVITY = 0.35
const JUMP_VEL = -10
const SPRING_VEL = -15
const MOVE_SPEED = 4
const FRICTION = 0.92
const PLATFORM_W = 70
const PLATFORM_H = 14
const PLAYER_W = 36
const PLAYER_H = 40
const BEAN_R = 8
const BEAN_SCORE = 10
const PLATFORM_GAP_MIN = 50
const PLATFORM_GAP_MAX = 110

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }

function createPlatforms(startY: number, endY: number, canvasW: number, existing: Platform[]): Platform[] {
  const plats = [...existing]
  let y = startY
  while (y > endY) {
    const gap = PLATFORM_GAP_MIN + Math.random() * (PLATFORM_GAP_MAX - PLATFORM_GAP_MIN)
    y -= gap
    const x = Math.random() * (canvasW - PLATFORM_W)
    const rng = Math.random()
    let type: Platform['type'] = 'normal'
    if (rng > 0.88) type = 'spring'
    else if (rng > 0.75) type = 'moving'
    else if (rng > 0.6) type = 'breaking'
    const p: Platform = { x, y, w: PLATFORM_W, type }
    if (type === 'moving') p.dx = (Math.random() > 0.5 ? 1 : -1) * (1.2 + Math.random() * 1.5)
    plats.push(p)
  }
  return plats
}

function spawnBeans(platforms: Platform[], existing: Bean[]): Bean[] {
  const beans = [...existing]
  for (const p of platforms) {
    if (Math.random() > 0.3) continue
    const bx = p.x + p.w / 2 + (Math.random() - 0.5) * 30
    const by = p.y - 25 - Math.random() * 30
    if (!beans.some(b => Math.abs(b.x - bx) < 20 && Math.abs(b.y - by) < 20)) {
      beans.push({ x: bx, y: by, collected: false })
    }
  }
  return beans
}

// ---------- COMPONENT ----------
interface Props {
  onGameOver: (score: number) => void
}

export default function CoffeeJumpGame({ onGameOver }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const rafRef = useRef(0)
  const keysRef = useRef<Record<string, boolean>>({})
  const touchXRef = useRef<number | null>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 })

  // ---------- INIT ----------
  const initGame = useCallback((w: number, h: number) => {
    const groundY = h - 60
    const startPlatforms: Platform[] = [{ x: w / 2 - PLATFORM_W / 2, y: groundY, w: PLATFORM_W, type: 'normal' }]
    const platforms = createPlatforms(groundY, groundY - h * 2, w, startPlatforms)
    const beans = spawnBeans(platforms, [])

    stateRef.current = {
      playerX: w / 2 - PLAYER_W / 2,
      playerY: groundY - PLAYER_H,
      playerVx: 0,
      playerVy: 0,
      playerW: PLAYER_W,
      playerH: PLAYER_H,
      platforms,
      beans,
      particles: [],
      score: 0,
      maxHeight: groundY,
      cameraY: 0,
      gameOver: false,
      started: false,
      facing: 'right',
    }
  }, [])

  // ---------- RESIZE ----------
  useEffect(() => {
    const measure = () => {
      const el = canvasRef.current?.parentElement
      if (!el) return
      const w = el.clientWidth
      const h = Math.min(el.clientHeight, window.innerHeight - 130)
      setCanvasSize({ w, h })
      if (!stateRef.current || stateRef.current.gameOver) initGame(w, h)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [initGame])

  // ---------- INPUT ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { keysRef.current[e.key] = e.type === 'keydown' }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey) }
  }, [])

  // Touch / tilt controls
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      touchXRef.current = e.touches[0].clientX
      if (stateRef.current && !stateRef.current.started) stateRef.current.started = true
    }
    const onTouchMove = (e: TouchEvent) => { touchXRef.current = e.touches[0].clientX }
    const onTouchEnd = () => { touchXRef.current = null }

    const el = canvasRef.current
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [canvasSize])

  // Device motion (tilt)
  useEffect(() => {
    const onMotion = (e: DeviceOrientationEvent) => {
      if (e.gamma != null && stateRef.current) {
        const tilt = clamp(e.gamma / 30, -1, 1)
        stateRef.current.playerVx = tilt * MOVE_SPEED * 2
        if (tilt > 0.1) stateRef.current.facing = 'right'
        else if (tilt < -0.1) stateRef.current.facing = 'left'
      }
    }
    window.addEventListener('deviceorientation', onMotion)
    return () => window.removeEventListener('deviceorientation', onMotion)
  }, [])

  // ---------- GAME LOOP ----------
  useEffect(() => {
    if (!canvasSize.w || !canvasSize.h) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvasSize.w
    const H = canvasSize.h

    if (!stateRef.current) initGame(W, H)

    const loop = () => {
      const s = stateRef.current!
      if (!s) return

      // --- INPUT ---
      const keys = keysRef.current
      if (keys['ArrowLeft'] || keys['a']) {
        s.playerVx = -MOVE_SPEED
        s.facing = 'left'
        if (!s.started) s.started = true
      } else if (keys['ArrowRight'] || keys['d']) {
        s.playerVx = MOVE_SPEED
        s.facing = 'right'
        if (!s.started) s.started = true
      } else if (touchXRef.current !== null) {
        const center = W / 2
        const diff = (touchXRef.current - center) / center
        s.playerVx = diff * MOVE_SPEED * 1.5
        s.facing = diff > 0 ? 'right' : 'left'
      } else {
        s.playerVx *= FRICTION
      }

      // --- PHYSICS ---
      if (s.started && !s.gameOver) {
        s.playerVy += GRAVITY
        s.playerX += s.playerVx
        s.playerY += s.playerVy

        // Wrap around screen
        if (s.playerX + s.playerW < 0) s.playerX = W
        if (s.playerX > W) s.playerX = -s.playerW

        // Move moving platforms
        for (const p of s.platforms) {
          if (p.type === 'moving' && p.dx) {
            p.x += p.dx
            if (p.x <= 0 || p.x + p.w >= W) p.dx *= -1
          }
        }

        // Platform collision (only when falling)
        if (s.playerVy > 0) {
          for (const p of s.platforms) {
            if (p.broken) continue
            const px = s.playerX
            const py = s.playerY + s.playerH
            const prevPy = py - s.playerVy
            if (
              px + s.playerW > p.x + 5 &&
              px < p.x + p.w - 5 &&
              prevPy <= p.y + 2 &&
              py >= p.y
            ) {
              if (p.type === 'breaking') {
                p.broken = true
                // particles
                for (let i = 0; i < 6; i++) {
                  s.particles.push({
                    x: p.x + p.w / 2,
                    y: p.y,
                    vx: (Math.random() - 0.5) * 4,
                    vy: -Math.random() * 3,
                    life: 30,
                    color: C.platformBreaking,
                    size: 3 + Math.random() * 3,
                  })
                }
              } else if (p.type === 'spring') {
                s.playerVy = SPRING_VEL
                p.springActive = true
                setTimeout(() => { p.springActive = false }, 200)
              } else {
                s.playerVy = JUMP_VEL
              }
              if (p.type !== 'breaking') {
                // Jump particles
                for (let i = 0; i < 4; i++) {
                  s.particles.push({
                    x: s.playerX + s.playerW / 2,
                    y: s.playerY + s.playerH,
                    vx: (Math.random() - 0.5) * 3,
                    vy: Math.random() * 2,
                    life: 15,
                    color: C.bean,
                    size: 2 + Math.random() * 2,
                  })
                }
              }
            }
          }
        }

        // Camera follow
        const scrollThreshold = H * 0.35
        if (s.playerY < s.cameraY + scrollThreshold) {
          const diff = (s.cameraY + scrollThreshold) - s.playerY
          s.cameraY -= diff
        }

        // Update score
        const height = (H - 60) - s.playerY
        if (height > s.maxHeight) {
          s.score += Math.floor(height - s.maxHeight)
          s.maxHeight = height
        }

        // Generate new platforms above
        const topVisible = s.cameraY - 200
        const highestPlat = Math.min(...s.platforms.map(p => p.y))
        if (highestPlat > topVisible) {
          const newPlats = createPlatforms(highestPlat, topVisible - H, W, [])
          s.platforms.push(...newPlats)
          const newBeans = spawnBeans(newPlats, [])
          s.beans.push(...newBeans)
        }

        // Remove platforms/beans below screen
        const bottomLine = s.cameraY + H + 100
        s.platforms = s.platforms.filter(p => p.y < bottomLine)
        s.beans = s.beans.filter(b => b.y < bottomLine && !b.collected)

        // Bean collision
        for (const b of s.beans) {
          if (b.collected) continue
          const dist = Math.hypot(s.playerX + s.playerW / 2 - b.x, s.playerY + s.playerH / 2 - b.y)
          if (dist < BEAN_R + 15) {
            b.collected = true
            s.score += BEAN_SCORE
            for (let i = 0; i < 5; i++) {
              s.particles.push({
                x: b.x, y: b.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 20,
                color: C.bean,
                size: 2 + Math.random() * 3,
              })
            }
          }
        }

        // Update particles
        s.particles = s.particles.filter(p => {
          p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--
          return p.life > 0
        })

        // Game over: fell below screen
        if (s.playerY > s.cameraY + H + 50) {
          s.gameOver = true
          onGameOver(s.score)
        }
      }

      // --- RENDER ---
      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, C.sky2)
      grad.addColorStop(1, C.sky1)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      ctx.save()
      ctx.translate(0, -s.cameraY)

      // Platforms
      for (const p of s.platforms) {
        if (p.broken) continue
        const ry = p.y
        ctx.beginPath()
        ctx.roundRect(p.x, ry, p.w, PLATFORM_H, 7)
        if (p.type === 'moving') ctx.fillStyle = C.platformMoving
        else if (p.type === 'breaking') {
          ctx.fillStyle = C.platformBreaking
          ctx.setLineDash([4, 3])
          ctx.strokeStyle = C.platform
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.setLineDash([])
        }
        else if (p.type === 'spring') ctx.fillStyle = C.platformSpring
        else ctx.fillStyle = C.platform
        ctx.fill()

        // Spring coil
        if (p.type === 'spring') {
          const sx = p.x + p.w / 2
          const sy = p.y
          const sh = p.springActive ? -18 : -10
          ctx.strokeStyle = C.spring
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          for (let i = 0; i < 4; i++) {
            const t = (i + 1) / 4
            ctx.lineTo(sx + (i % 2 === 0 ? -6 : 6), sy + sh * t)
          }
          ctx.stroke()
        }
      }

      // Beans
      for (const b of s.beans) {
        if (b.collected) continue
        ctx.save()
        ctx.translate(b.x, b.y)
        // Coffee bean shape
        ctx.fillStyle = C.bean
        ctx.beginPath()
        ctx.ellipse(0, 0, BEAN_R, BEAN_R * 1.3, 0, 0, Math.PI * 2)
        ctx.fill()
        // Bean line
        ctx.strokeStyle = C.beanDark
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(0, -BEAN_R * 1.1)
        ctx.bezierCurveTo(-3, -BEAN_R * 0.3, 3, BEAN_R * 0.3, 0, BEAN_R * 1.1)
        ctx.stroke()
        ctx.restore()
      }

      // Player (coffee cup)
      ctx.save()
      ctx.translate(s.playerX + s.playerW / 2, s.playerY + s.playerH / 2)
      const scaleX = s.facing === 'left' ? -1 : 1
      ctx.scale(scaleX, 1)

      // Cup body
      ctx.fillStyle = C.player
      ctx.beginPath()
      ctx.moveTo(-14, -12)
      ctx.lineTo(-11, 16)
      ctx.quadraticCurveTo(0, 22, 11, 16)
      ctx.lineTo(14, -12)
      ctx.closePath()
      ctx.fill()

      // Cup rim (cream)
      ctx.fillStyle = '#f5e6c8'
      ctx.beginPath()
      ctx.ellipse(0, -12, 15, 5, 0, 0, Math.PI * 2)
      ctx.fill()

      // Steam when going up
      if (s.playerVy < -2) {
        ctx.strokeStyle = 'rgba(200,180,160,0.5)'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        const t = Date.now() / 300
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath()
          ctx.moveTo(i * 6, -17)
          ctx.quadraticCurveTo(i * 6 + Math.sin(t + i) * 4, -25, i * 6, -33)
          ctx.stroke()
        }
      }

      // Eyes
      ctx.fillStyle = C.playerEye
      ctx.beginPath()
      ctx.ellipse(-5, -5, 4, 5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(5, -5, 4, 5, 0, 0, Math.PI * 2)
      ctx.fill()

      // Pupils
      ctx.fillStyle = C.playerPupil
      const pupilOff = s.playerVy < 0 ? -1 : 1
      ctx.beginPath()
      ctx.ellipse(-4, -5 + pupilOff, 2, 2.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(6, -5 + pupilOff, 2, 2.5, 0, 0, Math.PI * 2)
      ctx.fill()

      // Mouth
      if (s.gameOver) {
        ctx.strokeStyle = C.playerPupil
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(0, 4, 4, 0, Math.PI, true)
        ctx.stroke()
      } else {
        ctx.fillStyle = C.playerPupil
        ctx.beginPath()
        ctx.arc(0, 4, 3, 0, Math.PI, false)
        ctx.fill()
      }

      // Handle
      ctx.strokeStyle = C.player
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(16, 2, 7, -Math.PI / 2, Math.PI / 2, false)
      ctx.stroke()

      ctx.restore()

      // Particles
      for (const p of s.particles) {
        ctx.globalAlpha = p.life / 30
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      ctx.restore()

      // --- HUD ---
      // Score
      ctx.fillStyle = C.text
      ctx.font = 'bold 20px Inter, sans-serif'
      ctx.textAlign = 'left'
      ctx.fillText(`☕ ${s.score}`, 16, 32)

      // Start screen
      if (!s.started) {
        ctx.fillStyle = C.overlay
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 32px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Coffee Jump ☕', W / 2, H / 2 - 40)
        ctx.font = '16px Inter, sans-serif'
        ctx.fillText('Натисни або свайп щоб почати', W / 2, H / 2 + 10)
        ctx.font = '13px Inter, sans-serif'
        ctx.fillStyle = '#d9a84e'
        ctx.fillText('← → або нахиляй телефон', W / 2, H / 2 + 40)
      }

      // Game over screen
      if (s.gameOver) {
        ctx.fillStyle = C.overlay
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 28px Inter, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Гра закінчена!', W / 2, H / 2 - 50)
        ctx.font = 'bold 40px Inter, sans-serif'
        ctx.fillStyle = C.bean
        ctx.fillText(`☕ ${s.score}`, W / 2, H / 2 + 5)
        ctx.font = '14px Inter, sans-serif'
        ctx.fillStyle = '#fff'
        ctx.fillText('Натисни "Грати знову" щоб продовжити', W / 2, H / 2 + 40)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [canvasSize, initGame, onGameOver])

  const restart = () => {
    if (!canvasSize.w) return
    initGame(canvasSize.w, canvasSize.h)
  }

  const isGameOver = stateRef.current?.gameOver

  return (
    <div className="relative w-full flex flex-col items-center" style={{ height: canvasSize.h || 500 }}>
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        className="rounded-2xl border border-gray-200 shadow-sm touch-none"
        style={{ width: canvasSize.w, height: canvasSize.h }}
      />
      {isGameOver && (
        <button
          onClick={restart}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-coffee-500 hover:bg-coffee-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg active:scale-95 transition-transform text-lg"
        >
          Грати знову 🔄
        </button>
      )}
    </div>
  )
}
