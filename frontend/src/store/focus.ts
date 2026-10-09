/** Store de foco para transições sincronizadas */
import { useState } from 'react';

export type FocusType = 'home' | 'away';

let focusState: FocusType = 'home';
let subscribers: Array<(f: FocusType) => void> = [];

export const useFocus = () => {
  const [, forceUpdate] = useState(0);

  const setFocus = (newFocus: FocusType) => {
    focusState = newFocus;
    subscribers.forEach(sub => sub(newFocus));
    forceUpdate((n) => n + 1);
  };

  const toggleFocus = () => {
    setFocus(focusState === 'home' ? 'away' : 'home');
  };

  const subscribe = (fn: (f: FocusType) => void) => {
    subscribers.push(fn);
    return () => {
      subscribers = subscribers.filter(s => s !== fn);
    };
  };

  return {
    focus: focusState,
    setFocus,
    toggleFocus,
    subscribe,
    isHome: focusState === 'home',
    isAway: focusState === 'away',
  };
};

export const getFocus = (): FocusType => focusState;
export const setFocus = (f: FocusType) => { focusState = f; };
export const toggleFocus = () => { focusState = focusState === 'home' ? 'away' : 'home'; };