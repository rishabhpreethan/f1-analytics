import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { notFound, onError } from './errors';
import { rateLimit } from './middleware/rateLimit';
import { metaRoutes } from './routes/meta';
import { seasonRoutes } from './routes/seasons';

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
      // The one allowance in this policy, and it is **not** the precaution the previous
      // comment here claimed (ARCHITECTURE.md §7.4, §10 #26). "React and GSAP mutate
      // styles through the CSSOM, which CSP does not govern" is true and does not
      // finish the argument: `gsap/ScrollTrigger.js` also runs
      //
      //     if (!bodyHasStyle) { _body.setAttribute("style", ""); _body.removeAttribute("style"); }
      //
      // and `setAttribute('style', …)` is exactly the inline-style-attribute form that
      // `style-src-attr` governs, unlike `element.style.x = y`. That statement sits on
      // the path ScrollTrigger.enable() ← ScrollTrigger.register() ←
      // gsap.registerPlugin(), which runs at module evaluation of
      // src/lib/motion/gsap.ts — so on every page load, not only when a trigger is
      // created. Our <body> carries no `style` attribute, so the guard is satisfied and
      // the call runs. Verified present in the minified production bundle, asserted in
      // app.test.ts.
      //
      // Whether a browser *reports* a violation for an empty attribute value cannot be
      // settled in Node — jsdom implements no CSP enforcement. So the removal bar is
      // unchanged and is evidence, not reasoning: **zero CSP violations in the
      // production-preview console** (`npm run build && npm run start`), re-verified
      // after removal. Nobody has had a browser on it yet.
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
app.route('/api', seasonRoutes);

app.notFound(notFound);
app.onError(onError);
