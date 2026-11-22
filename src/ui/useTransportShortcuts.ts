import { useEffect } from 'react';

export interface ShortcutContext {
  code: string;
  repeat: boolean;
  hasModifier: boolean;
  /** Lower-case tag name of the element that has focus. */
  tag: string;
  inputType?: string;
  editable: boolean;
}

export type ShortcutAction = 'toggle' | 'stop' | null;

/** Decide what a key press means for the transport. Pure so it can be tested without a DOM. */
export function transportShortcut(c: ShortcutContext): ShortcutAction {
  if (c.hasModifier || c.editable) return null;
  if (c.tag === 'select' || c.tag === 'textarea') return null;
  if (c.tag === 'input' && c.inputType !== 'range') return null;
  if (c.code === 'Escape') return 'stop';
  if (c.code !== 'Space' || c.repeat) return null;
  // Pointer-focused controls are blurred below, so a focused control here was reached
  // by keyboard and keeps its native Space activation.
  if (c.tag === 'button' || c.tag === 'summary' || c.tag === 'a') return null;
  return 'toggle';
}

interface Options {
  canToggle: boolean;
  onToggle: () => void;
  onStop: () => void;
}

/**
 * Space toggles play/pause and Escape stops, wherever the pointer last clicked.
 * Controls activated by pointer give focus back to the page so the next Space
 * reaches the transport instead of re-firing the control.
 */
export function useTransportShortcuts({ canToggle, onToggle, onStop }: Options): void {
  useEffect(() => {
    let lastInput: 'pointer' | 'key' = 'key';

    function handlePointer() { lastInput = 'pointer'; }

    function handleKey(event: KeyboardEvent) {
      lastInput = 'key';
      if (event.defaultPrevented) return;
      const element = event.target instanceof HTMLElement ? event.target : null;
      const action = transportShortcut({
        code: event.code,
        repeat: event.repeat,
        hasModifier: event.metaKey || event.ctrlKey || event.altKey,
        tag: element?.tagName.toLowerCase() ?? '',
        inputType: element instanceof HTMLInputElement ? element.type : undefined,
        editable: element?.isContentEditable ?? false,
      });
      if (action === 'stop') {
        onStop();
      } else if (action === 'toggle') {
        event.preventDefault();
        if (canToggle) onToggle();
      }
    }

    function handleClick(event: MouseEvent) {
      // detail is 0 for keyboard-generated clicks; those keep focus.
      if (event.detail === 0 || !(event.target instanceof Element)) return;
      event.target.closest<HTMLElement>('button, summary')?.blur();
    }

    function handleChange(event: Event) {
      if (lastInput === 'pointer' && event.target instanceof HTMLSelectElement) event.target.blur();
    }

    window.addEventListener('pointerdown', handlePointer, true);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('click', handleClick);
    window.addEventListener('change', handleChange);
    return () => {
      window.removeEventListener('pointerdown', handlePointer, true);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('change', handleChange);
    };
  }, [canToggle, onToggle, onStop]);
}
