'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { Champion, TAG_COLORS, iconUrl } from '@/lib/riot'
import ChampionModal from './ChampionModal'

gsap.registerPlugin(SplitText, ScrambleTextPlugin)

// ─── Config ────────────────────────────────────────────
const RADIUS        = 250
const ICON          = 36
const HALF          = ICON / 2
const AUTO_SPEED    = 0        // auto-rotate disabled
const PERSP         = 900
const BASE_SCALE    = 3      // resting viewport scale (globe appears 3× larger)
const DRAG_SENS_Y   = 0.18   // horizontal drag → Y rotation
const DRAG_SENS_X   = 0.14   // vertical drag   → X rotation
const FRICTION_Y    = 0.97   // momentum decay Y  (higher = glides longer)
const FRICTION_X    = 0.94   // momentum decay X  (higher = glides longer)
const DRAG_THRESH   = 5      // px before we consider it a drag
const ZOOMED_SCALE  = 5      // viewport scale when globe is in "zoomed" state
const MIN_SCALE     = 1      // scroll zoom minimum
const MAX_SCALE     = 10     // scroll zoom maximum
const SCROLL_STEP   = 0.5    // scale change per scroll tick

const TAGS = ['All', 'Fighter', 'Tank', 'Mage', 'Assassin', 'Marksman', 'Support']

// ─── Helpers ───────────────────────────────────────────
function fibSphere(n: number) {
  const phi = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (i / (n - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    return { x: Math.cos(phi * i) * r, y, z: Math.sin(phi * i) * r }
  })
}

function rotate(x: number, y: number, z: number, angY: number, angX: number) {
  const cosY = Math.cos(angY), sinY = Math.sin(angY)
  const rx   = x * cosY + z * sinY
  const rz1  = -x * sinY + z * cosY
  const cosX = Math.cos(angX), sinX = Math.sin(angX)
  const ry   = y * cosX - rz1 * sinX
  const rz   = y * sinX + rz1 * cosX
  return { x: rx, y: ry, z: rz }
}

// ─── Component ─────────────────────────────────────────
interface Props { champions: Champion[]; version: string }

export default function GlobeScene({ champions, version }: Props) {
  const viewRef     = useRef<HTMLDivElement>(null)
  const miniRef     = useRef<HTMLCanvasElement>(null)
  const iconEls     = useRef<(HTMLDivElement | null)[]>([])
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const headingRef  = useRef<HTMLHeadingElement>(null)
  const nameRef     = useRef<HTMLParagraphElement>(null)
  const base    = useRef(fibSphere(champions.length))

  // Rotation angles (degrees, mutable — no re-renders)
  const angY = useRef(0)
  const angX = useRef(-8)

  // Drag state
  const isDown  = useRef(false)
  const hadDrag = useRef(false)  // true if pointer moved > threshold this cycle
  const dragLast = useRef({ x: 0, y: 0 })
  const dragStart = useRef({ x: 0, y: 0 })

  // Inertia velocities
  const velY = useRef(0)
  const velX = useRef(0)

  // Modal pause flag
  const modalOpen  = useRef(false)
  const isZoomed   = useRef(false)          // true when globe is zoomed in
  const viewScale  = useRef(BASE_SCALE)     // current viewport scale

  const [cursor,   setCursor]   = useState<'grab' | 'grabbing'>('grab')
  const [hovered,  setHovered]  = useState<Champion | null>(null)
  const [selected, setSelected] = useState<Champion | null>(null)
  const [origin,   setOrigin]   = useState<DOMRect  | null>(null)
  const [filter,   setFilter]   = useState('All')

  useEffect(() => { base.current = fibSphere(champions.length) }, [champions.length])

  // ── Load zoom + title entrance ────────────────────
  useEffect(() => {
    const vp = viewRef.current
    if (!vp) return

    // Globe scale-in
    gsap.fromTo(
      vp,
      { scale: BASE_SCALE * 0.55, opacity: 0 },
      { scale: BASE_SCALE,       opacity: 1, duration: 1.6, ease: 'power4.out' },
    )

    // "League of Legends" — chars fall in with blur
    if (subtitleRef.current) {
      const split = SplitText.create(subtitleRef.current, { type: 'chars' })
      gsap.fromTo(
        split.chars,
        { opacity: 0, y: -14, filter: 'blur(6px)' },
        {
          opacity: 1, y: 0, filter: 'blur(0px)',
          stagger: 0.045, duration: 0.65, ease: 'power2.out', delay: 0.25,
        },
      )
    }

    // "Champions" — chars rise up with perspective tilt
    if (headingRef.current) {
      const split = SplitText.create(headingRef.current, { type: 'chars' })
      gsap.set(headingRef.current, { perspective: 400 })
      gsap.fromTo(
        split.chars,
        { opacity: 0, y: 28, rotateX: -70 },
        {
          opacity: 1, y: 0, rotateX: 0,
          stagger: 0.055, duration: 0.85, ease: 'back.out(1.6)', delay: 0.55,
        },
      )
    }
  }, [])

  // ── ScrambleText on champion hover ────────────────
  useEffect(() => {
    const el = nameRef.current
    if (!el) return
    if (hovered) {
      gsap.to(el, {
        duration: 0.55,
        scrambleText: {
          text:      hovered.name,
          chars:     'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
          speed:     0.55,
          delimiter: '',
        },
      })
    } else {
      gsap.killTweensOf(el)
      el.textContent = ''
    }
  }, [hovered])

  // ── Pointer events for drag ────────────────────────
  useEffect(() => {
    const vp = viewRef.current
    if (!vp) return

    const onDown = (e: PointerEvent) => {
      isDown.current  = true
      hadDrag.current = false
      velY.current    = 0
      velX.current    = 0
      dragStart.current = { x: e.clientX, y: e.clientY }
      dragLast.current  = { x: e.clientX, y: e.clientY }
      setCursor('grabbing')
    }

    const onMove = (e: PointerEvent) => {
      if (!isDown.current) return  // only move on active drag

      const dx = e.clientX - dragLast.current.x
      const dy = e.clientY - dragLast.current.y
      const dist = Math.hypot(
        e.clientX - dragStart.current.x,
        e.clientY - dragStart.current.y,
      )

      if (dist > DRAG_THRESH) hadDrag.current = true

      if (hadDrag.current) {
        // Sensitivity scales down with zoom so apparent speed stays constant
        const sensY = DRAG_SENS_Y / viewScale.current
        const sensX = DRAG_SENS_X / viewScale.current

        angY.current += dx * sensY
        angX.current += dy * sensX

        // Clamp X so globe doesn't flip upside down
        angX.current = Math.max(-60, Math.min(60, angX.current))

        // Store velocity for momentum
        velY.current = dx * sensY
        velX.current = dy * sensX

        dragLast.current = { x: e.clientX, y: e.clientY }
      }
    }

    const onUp = () => {
      isDown.current = false
      setCursor('grab')
      // velocities continue in tick (inertia)
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (modalOpen.current) return

      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
        viewScale.current + (e.deltaY < 0 ? SCROLL_STEP : -SCROLL_STEP),
      ))
      if (next === viewScale.current) return

      viewScale.current = next
      isZoomed.current  = next > BASE_SCALE
      viewRef.current?.classList.toggle('zoomed', isZoomed.current)

      gsap.to(viewRef.current, {
        scale: next, duration: 0.35, ease: 'power2.out', overwrite: 'auto',
      })
    }

    vp.addEventListener('pointerdown',  onDown)
    vp.addEventListener('pointermove',  onMove)
    vp.addEventListener('pointerup',    onUp)
    vp.addEventListener('pointerleave', onUp)
    vp.addEventListener('wheel',        onWheel, { passive: false })

    return () => {
      vp.removeEventListener('pointerdown',  onDown)
      vp.removeEventListener('pointermove',  onMove)
      vp.removeEventListener('pointerup',    onUp)
      vp.removeEventListener('pointerleave', onUp)
      vp.removeEventListener('wheel',        onWheel)
    }
  }, [])

  // ── 3D animation tick ─────────────────────────────
  useEffect(() => {
    const tick = () => {
      if (modalOpen.current) return

      const dragging = isDown.current && hadDrag.current

      if (!dragging) {
        // Auto-rotate Y
        angY.current += AUTO_SPEED

        // Apply inertia
        angY.current += velY.current
        angX.current += velX.current
        velY.current *= FRICTION_Y
        velX.current *= FRICTION_X

        // Clamp X
        angX.current = Math.max(-60, Math.min(60, angX.current))
      }

      const radY = (angY.current * Math.PI) / 180
      const radX = (angX.current * Math.PI) / 180
      const cx   = window.innerWidth  / 2
      const cy   = window.innerHeight / 2

      for (let i = 0; i < champions.length; i++) {
        const el = iconEls.current[i]
        if (!el) continue

        const b = base.current[i]
        const { x, y, z } = rotate(
          b.x * RADIUS, b.y * RADIUS, b.z * RADIUS, radY, radX,
        )

        const scale  = Math.max(0.25, PERSP / (PERSP - z))
        const sx     = x * scale
        const sy     = y * scale
        const tx     = cx + sx - HALF
        const ty     = cy + sy - HALF
        const depth  = (z + RADIUS) / (RADIUS * 2)
        const vis    = filter === 'All' || champions[i].tags.includes(filter)
        const opacity = vis ? Math.max(0.04, depth) : 0.03
        const blur    = z < 0 ? ((-z / RADIUS) * 1.5).toFixed(1) : '0'

        el.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${scale.toFixed(3)})`
        el.style.opacity   = opacity.toFixed(2)
        el.style.zIndex    = String(Math.round(z + RADIUS))
        el.style.filter    = blur !== '0' ? `blur(${blur}px)` : 'none'
      }
    }

    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [champions, filter])

  // ── Mini map: all champions as colored dots on a sphere ──
  useEffect(() => {
    const PANEL = 150
    const CR    = 62    // sphere radius in canvas px
    const CX    = PANEL / 2
    const CY    = PANEL / 2

    // Primary tag color per champion (stable across frames)
    const colors = champions.map(c => TAG_COLORS[c.tags[0]] ?? '#c89b3c')

    const draw = () => {
      if (modalOpen.current) return
      const canvas = miniRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const radY = (angY.current * Math.PI) / 180
      const radX = (angX.current * Math.PI) / 180

      ctx.clearRect(0, 0, PANEL, PANEL)

      // ── Clip everything to the circle silhouette ──
      ctx.save()
      ctx.beginPath()
      ctx.arc(CX, CY, CR, 0, Math.PI * 2)
      ctx.clip()

      // Background
      ctx.fillStyle = 'rgba(5,5,10,0.92)'
      ctx.fillRect(0, 0, PANEL, PANEL)

      // ── Project all champions and sort back→front ──
      const items = champions.map((_, i) => {
        const b = base.current[i]
        const p = rotate(b.x * CR, b.y * CR, b.z * CR, radY, radX)
        return { x: CX + p.x, y: CY + p.y, z: p.z, color: colors[i] }
      })
      items.sort((a, b) => a.z - b.z)

      // Draw every champion — back face dimmer but always visible
      for (const it of items) {
        const front = it.z >= 0
        ctx.beginPath()
        ctx.arc(it.x, it.y, front ? 3 : 2, 0, Math.PI * 2)
        ctx.globalAlpha = front ? 0.90 : 0.28
        ctx.fillStyle = it.color
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // ── Faint equator line (front half only) ──
      ctx.strokeStyle = 'rgba(200,155,60,0.28)'
      ctx.lineWidth = 0.6
      let pen = false
      ctx.beginPath()
      for (let i = 0; i <= 72; i++) {
        const lon = (i / 72) * 2 * Math.PI
        const p = rotate(Math.cos(lon) * CR, 0, Math.sin(lon) * CR, radY, radX)
        if (p.z >= 0) {
          const sx = CX + p.x, sy = CY + p.y
          pen ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy)
          pen = true
        } else if (pen) {
          ctx.stroke(); ctx.beginPath(); pen = false
        }
      }
      if (pen) ctx.stroke()

      // ── Edge vignette — makes it read as a sphere ──
      const vig = ctx.createRadialGradient(CX, CY, CR * 0.45, CX, CY, CR)
      vig.addColorStop(0, 'rgba(0,0,0,0)')
      vig.addColorStop(1, 'rgba(0,0,0,0.52)')
      ctx.fillStyle = vig
      ctx.fillRect(0, 0, PANEL, PANEL)

      ctx.restore() // remove clip

      // ── Gold rim outside the clip ──
      ctx.beginPath()
      ctx.arc(CX, CY, CR, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(200,155,60,0.60)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    gsap.ticker.add(draw)
    return () => gsap.ticker.remove(draw)
  }, [champions])

  // ── Click handler ─────────────────────────────────
  // First click  → globe zooms in (stays live, no modal)
  // Second click → globe rushes forward, then modal opens
  const handleIconClick = useCallback((champ: Champion, el: HTMLDivElement) => {
    if (hadDrag.current) return

    if (!isZoomed.current) {
      // ── First click: zoom globe toward viewer, stay there
      isZoomed.current = true
      viewScale.current = ZOOMED_SCALE
      viewRef.current?.classList.add('zoomed')
      gsap.to(viewRef.current, {
        scale: ZOOMED_SCALE,
        duration: 0.8,
        ease: 'power3.out',
      })
      return
    }

    // ── Second click: rush forward and open modal
    const tl = gsap.timeline()

    // Phase 1 — globe rushes to fill screen
    tl.to(viewRef.current, {
      scale: 6,
      duration: 0.6,
      ease: 'power3.in',
    })

    // Phase 2 — quick fade out at peak
    tl.to(viewRef.current, {
      opacity: 0,
      duration: 0.1,
      ease: 'none',
      onComplete: () => {
        const rect = el.getBoundingClientRect()
        gsap.set(viewRef.current, { scale: BASE_SCALE * 0.25, opacity: 0 })
        modalOpen.current = true
        isZoomed.current  = false
        setOrigin(rect)
        setSelected(champ)
      },
    })
  }, [])

  // ── Click on globe background: zoom back out ──────
  const handleViewportClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed.current || hadDrag.current) return
    const clickedIcon = (e.target as Element).closest('.globe-icon')
    if (!clickedIcon) {
      isZoomed.current  = false
      viewScale.current = BASE_SCALE
      viewRef.current?.classList.remove('zoomed')
      gsap.to(viewRef.current, { scale: BASE_SCALE, duration: 0.55, ease: 'power3.out' })
    }
  }, [])

  const handleClose = useCallback(() => {
    setSelected(null)
    setOrigin(null)

    // Resume ticker right away (globe rotates while invisible)
    modalOpen.current = false
    isZoomed.current  = false
    viewScale.current = BASE_SCALE
    viewRef.current?.classList.remove('zoomed')
    iconEls.current.forEach((el) => {
      if (el) gsap.set(el, { clearProps: 'scale,opacity' })
    })

    // Zoom globe back in once modal finishes closing (~0.65s clip-path anim)
    gsap.fromTo(
      viewRef.current,
      { scale: BASE_SCALE * 0.25, opacity: 0 },
      { scale: BASE_SCALE, opacity: 1, duration: 0.6, ease: 'power3.out', delay: 0.5 },
    )
  }, [])

  return (
    <>
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(200,155,60,0.05) 0%, transparent 70%)',
        }}
      />

      {/* Title */}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-20 text-center pointer-events-none select-none">
        <p
          ref={subtitleRef}
          className="font-cinzel text-[9px] tracking-[0.5em] uppercase mb-2"
          style={{ color: 'rgba(200,155,60,0.55)' }}
        >
          League of Legends
        </p>
        <h1
          ref={headingRef}
          className="font-cinzel font-black text-2xl md:text-3xl gold-text leading-none"
        >
          Champions
        </h1>
      </div>

      {/* Hovered name — full-width so text-align:center always hits true center */}
      <div
        className="fixed inset-x-0 z-20 text-center pointer-events-none select-none"
        style={{
          bottom: '5.5rem',
          opacity: hovered ? 1 : 0,
          transform: `translateY(${hovered ? 0 : 8}px)`,
          transition: 'opacity 0.18s ease, transform 0.18s ease',
        }}
      >
        <p
          ref={nameRef}
          className="font-cinzel text-white font-bold text-sm leading-tight"
        />
        <p className="font-cinzel text-[10px] tracking-widest uppercase mt-0.5"
           style={{ color: '#c89b3c' }}>
          {hovered?.title}
        </p>
      </div>

      {/* Filters */}
      <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-20 flex gap-1.5 flex-wrap justify-center max-w-lg">
        {TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setFilter(tag)}
            className="font-cinzel text-[9px] tracking-widest uppercase px-3 py-1.5 border transition-colors duration-200"
            style={{
              borderColor: filter === tag
                ? (TAG_COLORS[tag] ?? '#c89b3c')
                : 'rgba(255,255,255,0.10)',
              color: filter === tag
                ? (TAG_COLORS[tag] ?? '#c89b3c')
                : 'rgba(255,255,255,0.30)',
              background:           'rgba(5,5,10,0.75)',
              backdropFilter:       'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Mini globe orientation indicator */}
      <canvas
        ref={miniRef}
        width={150}
        height={150}
        className="mini-globe-canvas fixed z-20 pointer-events-none"
        style={{ right: '1.75rem', top: '50%', transform: 'translateY(-50%)' }}
      />

      {/* Globe */}
      <div
        ref={viewRef}
        className="globe-viewport"
        style={{ opacity: 0, cursor }}
        onClick={handleViewportClick}
      >
        {champions.map((champ, i) => (
          <div
            key={champ.id}
            ref={(el) => { iconEls.current[i] = el }}
            className="globe-icon"
            onMouseEnter={() => setHovered(champ)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => {
              const el = iconEls.current[i]
              if (el) handleIconClick(champ, el)
            }}
          >
            <img
              src={iconUrl(version, champ.image.full)}
              alt={champ.name}
              width={ICON}
              height={ICON}
              draggable={false}
            />
            <span className="globe-icon-name">{champ.name}</span>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selected && origin && (
        <ChampionModal
          champion={selected}
          version={version}
          originRect={origin}
          onClose={handleClose}
        />
      )}
    </>
  )
}
