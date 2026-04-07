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
  '#6b3a2a', '#c8973a', '#3d1c02', '#d9a84e',
  '#6b3a2a', '#c8973a', '#3d1c02', '#d9a84e',
]

export default function FortuneWheel({ prizes, spinning, targetIndex, onSpinEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const angleRef = useRef(0)
  const spinningRef = useRef(false)
  const velocityRef = useRef(0)
  const targetAngleRef = useRef<number | null>(null)
  const rafRef = useRef(0)
  const [size, setSize] = useState(300)

  // Measure container
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
    const R = S / 2 - 8
    const n = prizes.length
    const arc = (2 * Math.PI) / n

    ctx.clearRect(0, 0, S, S)

    // Shadow
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.15)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 4
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.restore()

    // Sectors
    for (let i = 0; i < n; i++) {
      const startAngle = angle + i * arc
      const endAngle = startAngle + arc

      // Fill sector
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, R, startAngle, endAngle)
      ctx.closePath()
      ctx.fillStyle = COLORS[i % COLORS.length]
      ctx.fill()

      // Sector border
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 2
      ctx.stroke()

      // Text + emoji
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(startAngle + arc / 2)

      // Emoji
      ctx.font = `${Math.round(R * 0.16)}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(prizes[i].emoji, R * 0.55, 0)

      // Label (rotated for readability)
      ctx.rotate(0)
      ctx.font = `bold ${Math.round(R * 0.085)}px Inter, sans-serif`
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'center'

      const label = prizes[i].label
      // Split label for multiline
      const words = label.split(' ')
      if (words.length > 1) {
        ctx.fillText(words[0], R * 0.35, -6)
        ctx.fillText(words.slice(1).join(' '), R * 0.35, 8)
      } else {
        ctx.fillText(label, R * 0.35, 0)
      }

      ctx.restore()
    }

    // Center circle
    ctx.beginPath()
    ctx.arc(cx, cy, R * 0.18, 0, Math.PI * 2)
    ctx.fillStyle = '#fdf6ed'
    ctx.fill()
    ctx.strokeStyle = '#c8973a'
    ctx.lineWidth = 3
    ctx.stroke()

    // Center text
    ctx.fillStyle = '#6b3a2a'
    ctx.font = `bold ${Math.round(R * 0.1)}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SPIN', cx, cy)

    // Pointer (triangle at top)
    const pSize = 18
    ctx.beginPath()
    ctx.moveTo(cx, 2)
    ctx.lineTo(cx - pSize / 2, pSize + 4)
    ctx.lineTo(cx + pSize / 2, pSize + 4)
    ctx.closePath()
    ctx.fillStyle = '#c8973a'
    ctx.fill()
    ctx.strokeStyle = '#6b3a2a'
    ctx.lineWidth = 2
    ctx.stroke()
  }, [prizes, size])

  // Start spin animation
  useEffect(() => {
    if (!spinning || targetIndex === null || spinningRef.current) return
    spinningRef.current = true

    const n = prizes.length
    const arc = (2 * Math.PI) / n

    // We want the pointer (at top = -π/2) to land in the middle of targetIndex sector
    // Sector i center angle: angle + i*arc + arc/2
    // Pointer is at -π/2 (top)
    // We need: angle + targetIndex*arc + arc/2 = -π/2 (mod 2π)
    // angle = -π/2 - targetIndex*arc - arc/2

    const fullSpins = 5 + Math.floor(Math.random() * 3) // 5-7 full rotations
    const targetSectorAngle = -Math.PI / 2 - targetIndex * arc - arc / 2
    // Add randomness within sector (±30% of arc)
    const jitter = (Math.random() - 0.5) * arc * 0.5
    const finalAngle = targetSectorAngle + jitter - fullSpins * 2 * Math.PI

    targetAngleRef.current = finalAngle
    velocityRef.current = 0
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
        // Easing: move 4% of remaining distance each frame
        const speed = diff * 0.04
        angleRef.current += speed

        // Stop when very close
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
