import { getChampions } from '@/lib/riot'
import GlobeScene from '@/components/GlobeScene'

export default async function Home() {
  const { version, champions } = await getChampions()

  return (
    <main className="relative w-full h-full overflow-hidden" style={{ background: '#05050a' }}>
      {/* Deep space vignette */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      <GlobeScene champions={champions} version={version} />
    </main>
  )
}
