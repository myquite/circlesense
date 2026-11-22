import { useJudge } from '../../engine/useJudge';
import { formatChordLabel } from '../../engine/chordData';
import { useMidiInput } from '../../input/useMidiInput';
import { useMicInput } from '../../input/useMicInput';
import { isConnected } from '../../input/connection';
import { Button, SectionHeading } from '../primitives';
import { TARGET_NAMES } from '../labels';

const MAX_LOG_ROWS = 8;

export default function FeedbackDashboard() {
  const {
    clearResults,
    previousTake,
    isActive,
    currentBarAccuracy,
    currentBarTotal,
    sessionAccuracy,
    sessionTotal,
    outsideTargetLog,
  } = useJudge();

  const midiConnected = isConnected(useMidiInput().connection);
  const micConnected = isConnected(useMicInput().connection);
  const inputConnected = midiConnected || micConnected;

  const hasNotes = currentBarTotal > 0;
  const hasSessionNotes = sessionTotal > 0;

  // The live note lives in the play bar ("Heard"). This panel only explains why a take is not being scored.
  const notice = inputConnected
    ? null
    : isActive
      ? 'No input connected. Listening only; nothing is scored.'
      : 'No input connected. Connect one in Set up to score a take.';

  const barDisplay = hasNotes ? `${currentBarAccuracy}%` : '--';
  const sessionDisplay = hasSessionNotes ? `${sessionAccuracy}%` : '--';

  return (
    <aside aria-label="Review" className="zone-review scroll-cue flex flex-col gap-4 border-border-muted py-4 lg:border-l">
      <SectionHeading>Results</SectionHeading>

      {notice && (
        <p role="status" className="text-xs text-ink bg-surface border border-border-muted rounded-lg p-2">{notice}</p>
      )}

      <div className="grid grid-cols-1 gap-2">
        <Stat label="This bar" display={barDisplay} percent={hasNotes ? currentBarAccuracy : 0} />
        <Stat label="This take" display={sessionDisplay} percent={hasSessionNotes ? sessionAccuracy : 0} />
      </div>

      <p className="text-xs text-ink-muted">{sessionTotal} {sessionTotal === 1 ? 'note' : 'notes'} this take. The percentage is notes on target, not improvisation quality. Silence is unscored.</p>
      {previousTake && (
        <p className="text-xs text-ink bg-surface border border-border-muted rounded-lg p-2">
          Previous take: <span className="font-bold">{previousTake.accuracy}%</span> of {previousTake.total} notes
          {' '}· {TARGET_NAMES[previousTake.target]}
        </p>
      )}
      <Button disabled={!hasSessionNotes && !previousTake} onClick={clearResults}>Clear results</Button>

      <div className="space-y-2">
        <SectionHeading>Most frequent outside-target notes</SectionHeading>
        {outsideTargetLog.length === 0 ? (
          <p className="text-xs text-ink-muted">
            No outside-target notes yet.
          </p>
        ) : (
          outsideTargetLog.slice(0, MAX_LOG_ROWS).map((entry) => (
            <div
              key={`${entry.chordLabel}|${entry.pitchClass}`}
              className="flex justify-between items-center p-2 rounded-lg bg-surface border border-border-muted"
            >
              <span className="text-xs text-ink">
                <span className="font-bold text-sm">{entry.noteName}</span> over {formatChordLabel(entry.chordLabel)}
              </span>
              <span className="text-xs bg-border-muted text-ink px-2 py-0.5 rounded-full font-bold">
                {entry.count}x
              </span>
            </div>
          ))
        )}
        {outsideTargetLog.length > MAX_LOG_ROWS && (
          <p className="text-xs text-ink-muted">and {outsideTargetLog.length - MAX_LOG_ROWS} less frequent</p>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, display, percent }: { label: string; display: string; percent: number }) {
  return (
    <div className="bg-surface border border-border-muted p-3 rounded-lg">
      <div className="flex justify-between items-end">
        <span className="text-label text-ink-muted font-bold uppercase tracking-widest">{label}</span>
        <span className="text-lg font-bold text-ink">{display}</span>
      </div>
      <div className="mt-2 h-1 w-full bg-border-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
