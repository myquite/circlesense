import { useState } from 'react'
import SetupPanel from './ui/components/SetupPanel'
import PlayBar from './ui/components/PlayBar'
import CircleEngine from './ui/components/CircleEngine'
import FeedbackDashboard from './ui/components/FeedbackDashboard'
import ZoneTabs, { type Zone } from './ui/components/ZoneTabs'
import { useSettingsPersistence } from './state/useSettingsPersistence'
import { loadSettings } from './state/sessionStore'

// Three zones in task order: set up, play, review. Desktop shows all three side by side.
// Phones and tablets show one at a time under the chord being played, with the transport
// and tabs in thumb reach. The layout itself lives in index.css (.app-shell).
export default function App() {
  useSettingsPersistence()
  // A returning player with a saved progression lands ready to play; a new one starts in set up.
  const [zone, setZone] = useState<Zone>(() => (loadSettings()?.progression.length ? 'play' : 'setup'))

  return (
    <main data-tab={zone} className="app-shell bg-background-dark font-display text-ink">
      <SetupPanel />
      <PlayBar />
      <CircleEngine />
      <FeedbackDashboard />
      <ZoneTabs zone={zone} onChange={setZone} />
    </main>
  )
}
