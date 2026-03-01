import Header from './ui/components/Header'
import CircleEngine from './ui/components/CircleEngine'
import FeedbackDashboard from './ui/components/FeedbackDashboard'
import ScaleGuardrail from './ui/components/ScaleGuardrail'

export default function App() {
  return (
    <div className="bg-background-dark font-display text-slate-100 min-h-screen flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 flex overflow-hidden">
        <CircleEngine />
        <FeedbackDashboard />
      </main>
      <ScaleGuardrail />
    </div>
  )
}
