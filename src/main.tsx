import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { queryClient } from './lib/queryClient';
import './styles/index.css';

/**
 * `reducedMotion="user"` disables transform and layout animations when the user has
 * asked for reduced motion, while preserving opacity and colour animation. It does
 * **not** stop an opacity loop, which is why M-7's skeleton pulse branches on
 * `useReducedMotion()` explicitly.
 */
const container = document.getElementById('root');
if (container === null) {
  throw new Error('Cannot start: index.html is missing its #root container.');
}

createRoot(container).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MotionConfig>
  </StrictMode>,
);
