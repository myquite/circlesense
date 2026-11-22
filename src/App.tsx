import { useState } from 'react'
import SetupPanel from './ui/components/SetupPanel'
import PlayBar from './ui/components/PlayBar'
import CircleEngine from './ui/components/CircleEngine'
import FeedbackDashboard from './ui/components/FeedbackDashboard'
import ZoneTabs, { type Zone } from './ui/components/ZoneTabs'
import { useSettingsPersistence } from './state/useSettingsPersistence'
import { loadSettings, startingProgression } from './state/sessionStore'

// Three zones in task order: set up, play, review. Desktop shows all three side by side.
// Phones and tablets show one at a time under the chord being played, with the transport
// and tabs in thumb reach. The layout itself lives in index.css (.app-shell).
export default function App() {
  useSettingsPersistence()
  // Everyone lands ready to play (a first visit gets a default progression), except a
  // returning player who cleared theirs and needs set up first.
  const [zone, setZone] = useState<Zone>(() => (startingProgression(loadSettings()).length ? 'play' : 'setup'))

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
