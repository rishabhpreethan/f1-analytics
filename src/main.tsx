import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { queryClient } from './lib/queryClient';
import './styles/index.css';

/**
 * **There is no motion provider (CR-007).** The retired animation library's global
 * reduced-motion provider used to sit here, and it was always a partial guarantee — it
 * suppressed transform and layout animation but not an opacity loop, so the skeleton
 * pulse had to branch on the preference in JavaScript anyway.
 *
 * GSAP needs no provider because the guarantee is structural instead: every tween is
 * created inside `useMotion`, which runs its `animate` builder only in the
 * `no-preference` branch of `gsap.matchMedia()`. Under `reduce` no tween object is ever
 * constructed, GSAP's ticker sleeps, and the CSS resting state — which is always the
 * final readable state (MR-2) — is what the user sees. Nothing to configure and nothing
 * a call site can forget.
 */
const container = document.getElementById('root');
if (container === null) {
  throw new Error('Cannot start: index.html is missing its #root container.');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
