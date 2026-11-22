import { useJudge } from '../../engine/useJudge';

export type Zone = 'setup' | 'play' | 'review';

const TABS: { zone: Zone; label: string; icon: string }[] = [
  { zone: 'setup', label: 'Set up', icon: 'tune' },
  { zone: 'play', label: 'Play', icon: 'music_note' },
  { zone: 'review', label: 'Results', icon: 'bar_chart' },
];

/** Phone and tablet navigation between the three zones. Hidden on desktop, where all three show. */
export default function ZoneTabs({ zone, onChange }: { zone: Zone; onChange: (zone: Zone) => void }) {
  const { sessionAccuracy, sessionTotal } = useJudge();

  return (
    <nav aria-label="Zones" className="zone-tabs flex border-t border-border-muted bg-surface">
      {TABS.map((tab) => {
        const selected = tab.zone === zone;
        return (
          <button
            key={tab.zone}
            aria-current={selected ? 'page' : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-label font-bold uppercase tracking-widest ${
              selected ? 'text-ink' : 'text-ink-muted'
            }`}
            onClick={() => onChange(tab.zone)}
          >
            <span className={`material-symbols-outlined rounded-full px-4 text-lg ${selected ? 'bg-ink text-background-dark' : ''}`} aria-hidden="true">
              {tab.icon}
            </span>
            <span>
              {tab.label}
              {tab.zone === 'review' && sessionTotal > 0 && <span className="normal-case tracking-normal"> · {sessionAccuracy}%</span>}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
