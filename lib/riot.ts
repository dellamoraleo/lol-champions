export interface Champion {
  id: string
  key: string
  name: string
  title: string
  blurb: string
  tags: string[]
  image: { full: string }
  stats: {
    hp: number
    attackdamage: number
    armor: number
    spellblock: number
    attackspeed: number
  }
}

export interface ChampionDetail extends Champion {
  lore: string
  spells: Spell[]
  passive: {
    name: string
    description: string
    image: { full: string }
  }
}

export interface Spell {
  id: string
  name: string
  description: string
  image: { full: string }
}

export async function getLatestVersion(): Promise<string> {
  const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json', {
    next: { revalidate: 86400 },
  })
  const versions: string[] = await res.json()
  return versions[0]
}

export async function getChampions(): Promise<{ version: string; champions: Champion[] }> {
  const version = await getLatestVersion()
  const res = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
    { next: { revalidate: 86400 } }
  )
  const data = await res.json()
  const champions = (Object.values(data.data) as Champion[]).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
  return { version, champions }
}

export function splashUrl(id: string) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${id}_0.jpg`
}

export function loadingUrl(id: string) {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/loading/${id}_0.jpg`
}

export function iconUrl(version: string, filename: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${filename}`
}

export function spellIconUrl(version: string, filename: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${filename}`
}

export function passiveIconUrl(version: string, filename: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/passive/${filename}`
}

export const TAG_COLORS: Record<string, string> = {
  Fighter:  '#c8572a',
  Tank:     '#5b7fa6',
  Mage:     '#7b5ea7',
  Assassin: '#c84b4b',
  Marksman: '#c89b3c',
  Support:  '#4a9b7f',
}

export const STAT_MAX: Record<string, number> = {
  hp: 1200,
  attackdamage: 80,
  armor: 60,
  spellblock: 60,
  attackspeed: 1.2,
}
