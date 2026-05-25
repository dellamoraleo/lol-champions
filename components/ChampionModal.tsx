'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  Champion,
  ChampionDetail,
  TAG_COLORS,
  STAT_MAX,
  splashUrl,
  spellIconUrl,
  passiveIconUrl,
} from '@/lib/riot'

interface Props {
  champion: Champion
  version: string
  originRect: DOMRect
  onClose: () => void
}

export default function ChampionModal({ champion, version, originRect, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [detail, setDetail] = useState<ChampionDetail | null>(null)
  const [activeAbility, setActiveAbility] = useState<number | null>(null)

  // Fetch champion detail
  useEffect(() => {
    fetch(
      `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion/${champion.id}.json`
    )
      .then((r) => r.json())
      .then((d) => setDetail(d.data[champion.id] as ChampionDetail))
  }, [champion.id, version])

  // Open animation: circle clip at globe position → fullscreen
  useEffect(() => {
    const el = overlayRef.current
    const content = contentRef.current
    if (!el) return

    const vw = window.innerWidth
    const vh = window.innerHeight

    const top    = originRect.top
    const left   = originRect.left
    const right  = vw - originRect.right
    const bottom = vh - originRect.bottom
    // 50% round makes the clip start as a circle matching the globe
    const r = Math.round(Math.min(originRect.width, originRect.height) / 2)

    gsap.set(el, { clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round ${r}px)` })
    gsap.set(content, { opacity: 0, y: 30 })

    const tl = gsap.timeline()

    tl.to(el, {
      clipPath: 'inset(0px 0px 0px 0px round 0px)',
      duration: 0.7,
      ease: 'power4.inOut',
    }).to(
      content,
      { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
      '-=0.25'
    )
  }, [originRect])

  const handleClose = () => {
    const el = overlayRef.current
    const content = contentRef.current
    if (!el) return

    const vw = window.innerWidth
    const vh = window.innerHeight

    const top    = originRect.top
    const left   = originRect.left
    const right  = vw - originRect.right
    const bottom = vh - originRect.bottom
    const r = Math.round(Math.min(originRect.width, originRect.height) / 2)

    const tl = gsap.timeline({ onComplete: onClose })

    tl.to(content, { opacity: 0, y: 20, duration: 0.22, ease: 'power2.in' }).to(
      el,
      {
        clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px round ${r}px)`,
        duration: 0.6,
        ease: 'power4.inOut',
      },
      '-=0.05'
    )
  }

  const abilities = detail
    ? [
        { name: detail.passive.name, desc: detail.passive.description, img: passiveIconUrl(version, detail.passive.image.full), label: 'P' },
        ...detail.spells.map((s, i) => ({
          name: s.name,
          desc: s.description,
          img: spellIconUrl(version, s.image.full),
          label: ['Q', 'W', 'E', 'R'][i],
        })),
      ]
    : []

  const stats = detail
    ? [
        { key: 'hp',          label: 'HP',     val: detail.stats.hp },
        { key: 'attackdamage',label: 'AD',     val: detail.stats.attackdamage },
        { key: 'armor',       label: 'Armor',  val: detail.stats.armor },
        { key: 'spellblock',  label: 'MR',     val: detail.stats.spellblock },
      ]
    : []

  return (
    <div
      ref={overlayRef}
      className="modal-overlay fixed inset-0 z-50"
      style={{ clipPath: 'inset(100% 100% 100% 100%)' }}
    >
      {/* Background splash art */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${splashUrl(champion.id)})` }}
      />
      {/* Dark scrim */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-10 w-10 h-10 flex items-center justify-center rounded-full border border-white/20 text-white/60 hover:text-white hover:border-white/50 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Content */}
      <div
        ref={contentRef}
        className="relative z-10 h-full flex flex-col justify-end p-8 md:p-16 max-w-2xl"
      >
        {/* Tags */}
        <div className="flex gap-2 mb-4">
          {champion.tags.map((tag) => (
            <span
              key={tag}
              className="tag-badge"
              style={{ color: TAG_COLORS[tag] ?? '#c89b3c', borderColor: TAG_COLORS[tag] ?? '#c89b3c' }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Name */}
        <h2 className="font-cinzel text-5xl md:text-7xl font-black text-white leading-none mb-1">
          {champion.name}
        </h2>
        <p className="font-cinzel text-base md:text-lg text-[#c89b3c] mb-6 capitalize">
          {champion.title}
        </p>

        <div className="gold-line mb-6" />

        {/* Lore */}
        <p className="text-white/70 text-sm leading-relaxed mb-8 max-w-lg line-clamp-4">
          {detail?.lore ?? champion.blurb}
        </p>

        {/* Stats */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-8">
            {stats.map(({ key, label, val }) => {
              const pct = Math.min((val / (STAT_MAX[key] ?? 100)) * 100, 100)
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs text-white/50 mb-1 font-cinzel tracking-widest uppercase">
                    <span>{label}</span>
                    <span className="text-[#c89b3c]">{Math.round(val)}</span>
                  </div>
                  <div className="h-px bg-white/10 relative">
                    <div
                      className="absolute left-0 top-0 h-full bg-[#c89b3c]"
                      style={{ width: `${pct}%`, transition: 'width 1s cubic-bezier(.25,.46,.45,.94)' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Abilities */}
        {abilities.length > 0 && (
          <div>
            <p className="font-cinzel text-xs tracking-widest text-white/40 uppercase mb-3">Abilities</p>
            <div className="flex gap-3 flex-wrap">
              {abilities.map((ab, i) => (
                <button
                  key={i}
                  onClick={() => setActiveAbility(activeAbility === i ? null : i)}
                  className={`ability-btn relative group ${activeAbility === i ? 'active' : ''}`}
                >
                  <img
                    src={ab.img}
                    alt={ab.name}
                    width={52}
                    height={52}
                    className="rounded border border-white/20 object-cover"
                    style={{ filter: activeAbility === i ? 'brightness(1.3)' : 'brightness(0.85)' }}
                  />
                  <span className="absolute -bottom-1 -right-1 bg-black/80 border border-white/20 text-white text-[9px] font-cinzel w-4 h-4 flex items-center justify-center rounded-sm">
                    {ab.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Ability tooltip */}
            {activeAbility !== null && abilities[activeAbility] && (
              <div className="mt-4 p-4 bg-black/60 border border-[#c89b3c]/20 rounded backdrop-blur max-w-md">
                <p className="font-cinzel text-[#c89b3c] text-sm mb-1">
                  {abilities[activeAbility].name}
                </p>
                <p
                  className="text-white/65 text-xs leading-relaxed"
                  dangerouslySetInnerHTML={{
                    __html: abilities[activeAbility].desc.replace(/<[^>]+>/g, ''),
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
