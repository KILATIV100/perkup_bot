import { useRef, useEffect, useState, useCallback } from 'react'

export interface WheelPrize {
  id: string
  label: string
  emoji: string
  type: string
  value: number
}

interface Props {
  prizes: WheelPrize[]
  spinning: boolean
  targetIndex: number | null
  onSpinEnd: () => void
}

const COLORS = [
  '#6b3a2a', '#e8a838', '#2d6a4f', '#d4574a',
  '#5c4b9e', '#c8973a', '#1d7a8a', '#b85c38',
]

export default function FortuneWheel({ prizes, spinning, targetIndex, onSpinEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const angleRef = useRef(0)
  const spinningRef = useRef(false)
  const targetAngleRef = useRef<number | null>(null)
  const rafRef = useRef(0)
  const [size, setSize] = useState(300)

  useEffect(() => {
    const el = canvasRef.current?.parentElement
    if (!el) return
    const s = Math.min(el.clientWidth - 16, 320)
    setSize(s)
  }, [])

  const drawWheel = useCallback((ctx: CanvasRenderingContext2D, angle: number) => {
    const S = size
    const cx = S / 2
    const cy = S / 2
    const R = S / 2 - 10
    const n = prizes.length
    const arc = (2 * Math.PI) / n

    ctx.clearRect(0, 0, S, S)

    // Outer ring shadow
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.25)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 4
    ctx.beginPath()
    ctx.arc(cx, cy, R + 6, 0, Math.PI * 2)
    ctx.fillStyle = '#3d1c02'
    ctx.fill()
    ctx.restore()

    // Outer decorative ring
    ctx.beginPath()
    ctx.arc(cx, cy, R + 6, 0, Math.PI * 2)
    ctx.fillStyle = '#3d1c02'
    ctx.fill()

    // Gold dots on outer ring
    for (let i = 0; i < n * 2; i++) {
      const dotAngle = (i / (n * 2)) * Math.PI * 2
      const dotX = cx + Math.cos(dotAngle) * (R + 3)
      const dotY = cy + Math.sin(dotAngle) * (R + 3)
      ctx.beginPath()
      ctx.arc(dotX, dotY, 2, 0, Math.PI * 2)
      ctx.fillStyle = '#c8973a'
      ctx.fill()
    }

    // Sectors
    for (let i = 0; i < n; i++) {
      const startAngle = angle + i * arc
      const endAngle = startAngle + arc

      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, R, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = COLORS[i % COLORS.length]
      ctx.fill()

      // Sector border
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Emoji + Label
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(startAngle + arc / 2)

      // Emoji
      ctx.font = `${Math.round(R * 0.2)}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(prizes[i].emoji, R * 0.65, 0)

      // Label
      ctx.font = `bold ${Math.round(R * 0.095)}px sans-serif`
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'

      const label = prizes[i].label
      const words = label.split(' ')
      if (words.length > 1) {
        ctx.fillText(words[0], R * 0.38, -7)
        ctx.fillText(words.slice(1).join(' '), R * 0.38, 9)
      } else {
        ctx.fillText(label, R * 0.38, 0)
      }

      ctx.restore()
    }

    // Inner circle — decorative ring
    ctx.beginPath()
    ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2)
    ctx.fillStyle = '#3d1c02'
    ctx.fill()

    // Inner circle — center with gradient
    ctx.beginPath()
    ctx.arc(cx, cy, R * 0.18, 0, Math.PI * 2)
    const grad = ctx.createRadialGradient(cx, cy - 4, 0, cx, cy, R * 0.18)
    grad.addColorStop(0, '#fdf6ed')
    grad.addColorStop(1, '#e8d5b8')
    ctx.fillStyle = grad
    ctx.fill()
    ctx.strokeStyle = '#c8973a'
    ctx.lineWidth = 3
    ctx.stroke()

    // Center icon
    ctx.fillStyle = '#6b3a2a'
    ctx.font = `bold ${Math.round(R * 0.11)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('☕', cx, cy - 2)

    // Pointer triangle at top
    const pW = 22
    const pH = 26
    ctx.beginPath()
    ctx.moveTo(cx, 0)
    ctx.lineTo(cx - pW / 2, pH)
    ctx.lineTo(cx + pW / 2, pH)
    ctx.closePath()
    ctx.fillStyle = '#c8973a'
    ctx.fill()
    ctx.strokeStyle = '#3d1c02'
    ctx.lineWidth = 2.5
    ctx.stroke()

  }, [prizes, size])

  // Start spin
  useEffect(() => {
    if (!spinning || targetIndex === null || spinningRef.current) return
    spinningRef.current = true

    const n = prizes.length
    const arc = (2 * Math.PI) / n
    const fullSpins = 5 + Math.floor(Math.random() * 3)
    const targetSectorAngle = -Math.PI / 2 - targetIndex * arc - arc / 2
    const jitter = (Math.random() - 0.5) * arc * 0.5
    const finalAngle = targetSectorAngle + jitter - fullSpins * 2 * Math.PI

    targetAngleRef.current = finalAngle
  }, [spinning, targetIndex, prizes])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const animate = () => {
      if (spinningRef.current && targetAngleRef.current !== null) {
        const target = targetAngleRef.current
        const diff = target - angleRef.current
        const speed = diff * 0.04
        angleRef.current += speed

        if (Math.abs(diff) < 0.001) {
          angleRef.current = target
          spinningRef.current = false
          targetAngleRef.current = null
          onSpinEnd()
        }
      }

      drawWheel(ctx, angleRef.current)
      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [drawWheel, onSpinEnd])

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="touch-none"
      />
    </div>
  )
}
