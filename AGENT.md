# AGENT.md – CircleSense Development Guide

## Project Purpose

CircleSense is a deterministic harmonic training tool.

This project prioritizes:

- Timing stability
- Modular architecture
- Clear separation of musical logic from UI
- Extensibility for future gamification

---

## Agent Constraints

When modifying or generating code:

- DO NOT couple UI logic to audio scheduling
- DO NOT move timing-critical logic into React render cycle
- DO NOT change core Conductor tempo implementation without testing drift
- DO NOT reduce pitch detection confidence gating

---

## Architecture Rules

### 1. Conductor is Authoritative Clock

- All musical events derive from Conductor time.
- Judge uses Conductor timing for per-bar stats.
- UI must never drive musical timing.

### 2. Audio is Scheduled, Not Triggered Live

- PlaybackEngine must use scheduled Web Audio calls.
- No setInterval for chord switching.

### 3. InputEngine Is Isolated

- MIDI and Mic detection logic separated.
- DetectedNote events are pure data.
- Judge does not know input source internals.

### 4. Judge Is Stateless Except ScoreState

- No UI references inside Judge.
- All scoring derived from pitchClass comparison only.

---

## File Structure Guidelines


/src
/audio
conductor.ts
playbackEngine.ts
/input
midiInput.ts
micInput.ts
/engine
judge.ts
scaleEngine.ts
/ui
components/
/state
sessionStore.ts


---

## Development Order (Thin Vertical Slice)

1. Implement Conductor
2. Implement basic PlaybackEngine
3. Hardcode Scale (G Major) and test Judge manually
4. Integrate MIDI detection
5. Display live pitch class + in/out feedback
6. Add mic detection
7. Build full UI wiring
8. Add persistence

No gamification before stage 8.

---

## Testing Expectations

Before merging changes:

- Verify BPM 60, 120, 240 stable
- Verify chord transitions align with bar
- Verify MIDI mode accuracy 100%
- Verify mic mode does not trigger false positives when silent

---

## Future Extensions (Design, Not Implement Yet)

- Chord-tone scoring
- Follow changes mode
- Gamification layer
- Adaptive tempo
- Modal interchange practice

Agents must not implement these features unless explicitly instructed.

---

## Philosophical Constraint

This project is about:

Clarity > Complexity  
Stability > Flashiness  
Accuracy > Gamification  

Build a harmonic instrument, not an arcade toy.

---

END OF AGENT DOC
