'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { Champion, TAG_COLORS, loadingUrl } from '@/lib/riot'
import ChampionModal from './ChampionModal'

const GLOBE_SIZE = 130   // sphere px (bigger, fewer on screen)
const CARD_H     = 175   // card height px in square mode

interface Props {
  champions: Champion[]
  version: string
}

export default function ChampionGallery({ champions, version }: Props) {
  const [selected, setSelected]     = useState<Champion | null>(null)
  const [originRect, setOriginRect] = useState<DOMRect | null>(null)
  const [filter, setFilter]         = useState('All')
  const [search, setSearch]         = useState('')
  const [mode, setMode]             = useState<'sphere' | 'cards'>('sphere')

  const modeRef  = useRef<'sphere' | 'cards'>('sphere')
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const gridRef  = useRef<HTMLDivElement>(null)

  const tags = ['All', 'Fighter', 'Tank', 'Mage', 'Assassin', 'Marksman', 'Support']

  const filtered = champions.filter((c) => {
    const matchTag    = filter === 'All' || c.tags.includes(filter)
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    return matchTag && matchSearch
  })

  // Stagger-in on filter/search change
  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll('.globe-card')
    if (!cards?.length) return
    gsap.fromTo(
      cards,
      { opacity: 0, y: 24, scale: 0.85 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.02, ease: 'power2.out' }
    )
  }, [filter, search])

  // After mode switches to 'cards': clear GSAP inline styles + animate cards in
  useEffect(() => {
    if (mode !== 'cards') return
    gsap.set('.globe', { clearProps: 'transform,opacity' })
    gsap.fromTo(
      '.globe-card',
      { opacity: 0, scale: 0.88, y: 16 },
      { opacity: 1, scale: 1, y: 0, duration: 0.38, stagger: 0.012, ease: 'power2.out', delay: 0.05 }
    )
  }, [mode])

  // ── Click handlers ─────────────────────────────────────
  const handleCardClick = useCallback(
    (champion: Champion, cardEl: HTMLDivElement) => {
      if (modeRef.current === 'sphere') {
        // ZOOM: the clicked sphere blasts toward the viewer, others shrink away
        modeRef.current = 'cards'

        const globeEl    = cardEl.querySelector('.globe') as HTMLElement
        const allGlobes  = gsap.utils.toArray<HTMLElement>('.globe')
        const otherGlobes = allGlobes.filter((g) => g !== globeEl)

        const tl = gsap.timeline({ onComplete: () => setMode('cards') })

        // Others: pull back and fade
        tl.to(otherGlobes, {
          scale: 0.55,
          opacity: 0,
          duration: 0.28,
          stagger: { amount: 0.12, from: 'random' },
          ease: 'power2.in',
        })

        // Clicked: ZOOM FORWARD — scale up big, then blast through opacity
        tl.to(
          globeEl,
          {
            scale: 6,
            opacity: 0,
            duration: 0.38,
            ease: 'power3.in',
          },
          '-=0.18'
        )
      } else {
        // Card mode: open fullscreen modal
        const globeEl = cardEl.querySelector('.globe') as HTMLElement
        setOriginRect((globeEl ?? cardEl).getBoundingClientRect())
        setSelected(champion)
      }
    },
    []
  )

  const resetToSphere = useCallback(() => {
    modeRef.current = 'sphere'
    const tl = gsap.timeline({ onComplete: () => setMode('sphere') })

    tl.to('.globe-card', {
      opacity: 0,
      scale: 0.8,
      duration: 0.22,
      stagger: 0.008,
      ease: 'power2.in',
    }).set('.globe', { clearProps: 'all' })
  }, [])

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#080808]/88 backdrop-blur border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {mode === 'cards' && (
              <button
                onClick={resetToSphere}
                className="font-cinzel text-[10px] tracking-widest uppercase px-3 py-1.5 rounded border border-[#c89b3c]/40 text-[#c89b3c] hover:border-[#c89b3c] transition-colors mr-1"
              >
                ← Spheres
              </button>
            )}
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilter(tag)}
                className="font-cinzel text-[10px] tracking-widest uppercase px-3 py-1.5 rounded border transition-all duration-200"
                style={{
                  borderColor: filter === tag ? (TAG_COLORS[tag] ?? '#c89b3c') : 'rgba(255,255,255,0.1)',
                  color:       filter === tag ? (TAG_COLORS[tag] ?? '#c89b3c') : 'rgba(255,255,255,0.35)',
                  background:  filter === tag ? 'rgba(200,155,60,0.05)' : 'transparent',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white/5 border border-white/10 rounded px-4 py-1.5 text-white placeholder-white/25 outline-none focus:border-[#c89b3c]/40 transition-colors w-full sm:w-44 font-cinzel text-[11px] tracking-widest"
          />
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────── */}
      <div
        ref={gridRef}
        className={`max-w-7xl mx-auto px-10 py-14 ${
          mode === 'sphere'
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-8 gap-y-14'
            : 'mode-cards grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5'
        }`}
      >
        {filtered.map((champion) => (
          <GlobeCard
            key={champion.id}
            champion={champion}
            mode={mode}
            onRef={(el) => {
              if (el) cardRefs.current.set(champion.id, el)
              else cardRefs.current.delete(champion.id)
            }}
            onClick={handleCardClick}
          />
        ))}
      </div>

      {/* ── Modal ────────────────────────────────────── */}
      {selected && originRect && (
        <ChampionModal
          champion={selected}
          version={version}
          originRect={originRect}
          onClose={() => { setSelected(null); setOriginRect(null) }}
        />
      )}
    </>
  )
}

// ── Globe Card ────────────────────────────────────────────
function GlobeCard({
  champion,
  mode,
  onRef,
  onClick,
}: {
  champion: Champion
  mode: 'sphere' | 'cards'
  onRef: (el: HTMLDivElement | null) => void
  onClick: (c: Champion, el: HTMLDivElement) => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const globeRef   = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)

  const onEnter = () => {
    if (!globeRef.current) return
    gsap.to(globeRef.current, { scale: 1.10, duration: 0.32, ease: 'power2.out' })
  }
  const onLeave = () => {
    if (!globeRef.current) return
    gsap.to(globeRef.current, { scale: 1, duration: 0.4, ease: 'power2.out' })
  }

  return (
    <div
      ref={(el) => { wrapperRef.current = el; onRef(el) }}
      className="globe-card"
      onClick={() => wrapperRef.current && onClick(champion, wrapperRef.current)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="relative">
        {/* Globe / card */}
        <div
          ref={globeRef}
          className="globe"
          style={{ width: GLOBE_SIZE, height: GLOBE_SIZE }}
        >
          {!loaded && (
            <div className="absolute inset-0 bg-[#181818] animate-pulse" />
          )}

          <img
            src={loadingUrl(champion.id)}
            alt={champion.name}
            width={GLOBE_SIZE}
            height={CARD_H}
            className="w-full h-full object-cover transition-opacity duration-500"
            style={{ opacity: loaded ? 1 : 0, objectPosition: 'center 6%' }}
            onLoad={() => setLoaded(true)}
          />

          {/* Vignette + name (CSS shows these only in card mode) */}
          <div className="card-vignette" />
          <div className="card-name-overlay">
            <p className="font-cinzel text-white text-xs font-bold leading-tight truncate">
              {champion.name}
            </p>
            <p
              className="font-cinzel text-[9px] tracking-widest uppercase mt-0.5"
              style={{ color: TAG_COLORS[champion.tags[0]] ?? '#c89b3c' }}
            >
              {champion.tags[0]}
            </p>
          </div>
        </div>

        {/* Orbital ring */}
        <div className="globe-ring" />
      </div>

      {/* Ground glow — sphere mode only */}
      <div className="globe-glow" />
    </div>
  )
}
