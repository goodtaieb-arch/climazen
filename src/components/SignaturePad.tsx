import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

type Props = {
  label: string
  value?: string
  onChange: (dataUrl: string) => void
  /** Hauteur du pad (px) — plus grand sur téléphone */
  height?: number
  hint?: string
}

/**
 * Pad de signature tactile (doigt / stylet) — export PNG data URL.
 */
export function SignaturePad({ label, value, onChange, height = 160, hint }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(!value)

  const resizeCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = parent.clientWidth
    const h = height
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (value) {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, w, h)
        setEmpty(false)
      }
      img.src = value
    }
  }

  useEffect(() => {
    resizeCanvas()
    const onResize = () => resizeCanvas()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  useEffect(() => {
    if (!value) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.onload = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      setEmpty(false)
    }
    img.src = value
  }, [value])

  const pos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const emit = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(canvas.toDataURL('image/png'))
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    drawing.current = true
    setEmpty(false)
    const ctx = canvas.getContext('2d')!
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    drawing.current = false
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    emit()
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight)
    setEmpty(true)
    onChange('')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        <button
          type="button"
          onClick={clear}
          className="text-xs font-medium text-muted underline hover:text-ink"
        >
          Effacer
        </button>
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <div className="overflow-hidden rounded-xl border-2 border-dashed border-line bg-white touch-none">
        <canvas
          ref={canvasRef}
          className="block w-full touch-none cursor-crosshair"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
      <p className="text-[11px] text-muted">
        {empty ? 'Signez avec le doigt ou un stylet' : 'Signature enregistrée'}
      </p>
    </div>
  )
}
