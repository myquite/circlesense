# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CircleSense is a deterministic harmonic training tool for intelligent scale practice. It helps musicians practice chord progressions and scales with real-time pitch detection feedback. Built with TypeScript, React, Web Audio API, and Tailwind CSS.

**Status**: Early-stage — AGENT.md and UI mockup exist, but source code implementation has not yet begun.

## Build & Development Commands

No build system is configured yet. When set up, this section should be updated with build, test, lint, and dev server commands.

## Architecture

### Core Modules (planned in `/src`)

- **`/audio/conductor.ts`** — Authoritative clock for all musical events. All timing derives from here. UI must never drive musical timing.
- **`/audio/playbackEngine.ts`** — Scheduled Web Audio API calls for chord playback. Must use Web Audio scheduling, never `setInterval` for chord switching.
- **`/input/midiInput.ts`** and **`/input/micInput.ts`** — Isolated input detection. Emit pure `DetectedNote` data events. Judge does not know input source internals.
- **`/engine/judge.ts`** — Stateless scoring engine (only holds `ScoreState`). All scoring from `pitchClass` comparison only. No UI references.
- **`/engine/scaleEngine.ts`** — Scale and chord definitions.
- **`/ui/components/`** — React components, fully decoupled from audio scheduling and timing.
- **`/state/sessionStore.ts`** — Session persistence.

### Key Architectural Rules

1. **Conductor is the single source of truth for timing** — Judge uses Conductor timing for per-bar stats
2. **Audio is scheduled, not triggered live** — Web Audio API scheduling only
3. **Input engines are isolated** — MIDI and mic detection are separate, emit pure data
4. **Judge is stateless** — No UI coupling, scoring from pitchClass comparison only
5. **UI is decoupled from timing** — No timing-critical logic in React render cycle

### Development Order (Thin Vertical Slice)

Follow this sequence: Conductor → PlaybackEngine → Judge (hardcoded G Major) → MIDI input → Live pitch feedback UI → Mic input → Full UI wiring → Persistence. No gamification before persistence is complete.

## Critical Constraints

- DO NOT couple UI logic to audio scheduling
- DO NOT move timing-critical logic into React render cycle
- DO NOT change core Conductor tempo implementation without testing drift at BPM 60, 120, 240
- DO NOT reduce pitch detection confidence gating
- DO NOT implement future extensions (chord-tone scoring, follow changes, gamification, adaptive tempo, modal interchange) unless explicitly instructed

## Testing Requirements

Before merging: verify BPM stability at 60/120/240, chord transitions align with bar timing, MIDI accuracy at 100%, and mic mode has no false positives when silent.

## Design Philosophy

Clarity > Complexity. Stability > Flashiness. Accuracy > Gamification. This is a harmonic instrument, not an arcade toy.
