import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { notFound, onError } from './errors';
import { rateLimit } from './middleware/rateLimit';
import { metaRoutes } from './routes/meta';

/**
 * The Hono application, exported without listening so tests can drive it directly.
 *
 * Middleware order is load-bearing (Technical Spec §2.4).
 */

export const app = new Hono();

// 1. Security headers on `*`, so error and 404 responses carry them too.
app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      // S-9: never 'unsafe-inline' for scripts. The pre-paint theme script is
      // therefore an external public/theme-init.js, not an inline block.
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      // Provisional allowance. React and Framer Motion mutate styles through the
      // CSSOM, which CSP does not govern, so this may well be unnecessary — T13
      // settles it against the production build, not by reasoning.
      styleSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      // DL-2/S-1 enforced by the browser: a stray third-party fetch fails loudly
      // instead of quietly violating the no-third-party-call rule.
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'none'"],
      upgradeInsecureRequests: [],
    },
    xFrameOptions: 'DENY',
    xContentTypeOptions: true,
    referrerPolicy: 'no-referrer',
    crossOriginOpenerPolicy: true,
    removePoweredBy: true,
  }),
);

// 2. No CORS middleware, on purpose. Omitting it means no Access-Control-Allow-Origin
//    header is ever sent, so browsers refuse cross-origin reads — that *is*
//    same-origin-only (S-11, ARCHITECTURE.md §7.2). Do **not** add `hono/cors`:
//    adding it to close a perceived gap would open one.

// 3. Per-IP rate limit on the API surface (S-13).
app.use('/api/*', rateLimit());

// 4. Routes. Handlers validate, call one named query, and return.
app.route('/api', metaRoutes);

app.notFound(notFound);
app.onError(onError);
