import SetupPanel from './ui/components/SetupPanel'
import PlayBar from './ui/components/PlayBar'
import CircleEngine from './ui/components/CircleEngine'
import FeedbackDashboard from './ui/components/FeedbackDashboard'
import { useSettingsPersistence } from './state/useSettingsPersistence'

// Three zones in task order: set up (left), play (centre), review (right).
// Below 1024px they stack in the same order and the play bar stays pinned.
export default function App() {
  useSettingsPersistence()

  return (
    <div className="bg-background-dark font-display text-ink min-h-screen lg:h-dvh lg:overflow-hidden">
      <main className="flex flex-col lg:grid lg:h-full lg:grid-cols-[auto_minmax(0,1fr)_20rem] lg:grid-rows-[auto_minmax(0,1fr)]">
        <SetupPanel />
        <PlayBar />
        <CircleEngine />
        <FeedbackDashboard />
      </main>
    </div>
  )
}
