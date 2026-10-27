import geistMono400 from '@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2?url';
import geistSans400 from '@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff2?url';
import geistSans600 from '@fontsource/geist-sans/files/geist-sans-latin-600-normal.woff2?url';
import { useStore } from '@nanostores/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { useEffect } from 'react';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
  type LinksFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
} from 'react-router';
import { cssTransition, ToastContainer } from 'react-toastify';
import '@fontsource/geist-sans/latin-400.css';
import '@fontsource/geist-sans/latin-500.css';
import '@fontsource/geist-sans/latin-600.css';
import '@fontsource/geist-sans/latin-700.css';
import '@fontsource/geist-mono/latin-400.css';
import '@fontsource/geist-mono/latin-500.css';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';

import 'virtual:uno.css';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  { rel: 'manifest', href: '/site.webmanifest' },
  {
    rel: 'preload',
    href: geistSans400,
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'preload',
    href: geistSans600,
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'preload',
    href: geistMono400,
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    try {
      const options = JSON.parse(localStorage.getItem('bolt_interface_options') || '{}');
      const root = document.documentElement;
      root.dataset.accentIntensity = String(typeof options.accentIntensity === 'number' ? options.accentIntensity : 50);
      root.style.setProperty('--interface-accent-strength', String(typeof options.accentIntensity === 'number' ? options.accentIntensity : 50) + '%');
      root.dataset.cornerRadius = ['sharp', 'soft', 'round'].includes(options.cornerRadius) ? options.cornerRadius : 'soft';
      root.dataset.compactMode = String(Boolean(options.compactMode));
      root.dataset.animatedTransitions = String(
        options.animatedTransitions !== false && !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
    } catch {}
    let colorTheme = localStorage.getItem('bolt_theme');

    if (!colorTheme) {
      colorTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    colorTheme = colorTheme === 'light' || colorTheme.startsWith('light') ? 'light' : 'dark';
    document.querySelector('html')?.setAttribute('data-theme', colorTheme);
    document.querySelector('html')?.setAttribute('data-color-theme', colorTheme);
  }
`;

const inlineOpenRouterCallbackStrip = stripIndents`
  (function () {
    try {
      if (location.pathname !== '/auth/openrouter/callback') return;
      var params = new URLSearchParams(location.search);
      window.__HYPEABLE_OR_CB = {
        code: params.get('code'),
        state: params.get('state'),
        error: params.get('error'),
      };
      history.replaceState({}, '', location.pathname);
    } catch (e) {}
  })();
`;

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-color-theme', theme);
  }, [theme]);

  // The theme script applies saved browser preferences before hydration.
  return (
    <html lang="en" suppressHydrationWarning data-theme={theme} data-color-theme={theme} className="w-full h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
        <script dangerouslySetInnerHTML={{ __html: inlineOpenRouterCallbackStrip }} />
      </head>
      <body className="w-full h-full">
        {/*
          Home chrome (hero, composer, skip link) must be in the first HTML so
          LCP is not blocked on 1 MiB of client JS. Window-only trees stay
          behind ClientOnly in the routes (Chat, Menu, onboarding).
        */}
        <noscript>
          <p style={{ margin: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
            Hypeable needs JavaScript to build apps in your browser. Privacy and terms still apply at /privacy and
            /terms.
          </p>
        </noscript>
        {children}
        <ToastContainer
          closeButton={({ closeToast }) => {
            return (
              <button className="Toastify__close-button" aria-label="Close notification" onClick={closeToast}>
                <div className="i-ph:x text-lg" />
              </button>
            );
          }}
          icon={({ type }) => {
            switch (type) {
              case 'success': {
                return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
              }
              case 'error': {
                return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
              }
            }

            return undefined;
          }}
          position="bottom-right"
          pauseOnFocusLoss
          transition={toastAnimation}
          autoClose={3000}
        />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

import { AppErrorPage } from './components/ui/AppErrorPage';
import { journeys, observeWebVitals } from './lib/performance/metrics';
import { isHostedFromContext } from './lib/security/hosted';
import { hostedModeStore, setHostedMode } from './lib/stores/hosted';
import { logStore } from './lib/stores/logs';
import { themeStore } from './lib/stores/theme';
import globalStyles from './styles/index.scss?url';
import { brandMeta } from './utils/brand';
import { stripIndents } from './utils/stripIndent';

export const meta: MetaFunction = () => brandMeta();

export async function loader({ context }: LoaderFunctionArgs) {
  return { hosted: isHostedFromContext(context) };
}

export default function App() {
  const theme = useStore(themeStore);
  const { hosted } = useLoaderData<typeof loader>();

  if (hostedModeStore.get() !== hosted) {
    setHostedMode(hosted);
  }

  useEffect(() => {
    // Mark app launch start
    journeys.appLaunch.start();
    journeys.appLaunch.reactHydrated();

    logStore.logSystem('Application initialized', {
      theme,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    observeWebVitals();

    // Initialize debug logging with improved error handling
    import('./utils/debugLogger')
      .then(({ debugLogger }) => {
        /*
         * The debug logger initializes itself and starts disabled by default
         * It will only start capturing when enableDebugMode() is called
         */
        const status = debugLogger.getStatus();
        logStore.logSystem('Debug logging ready', {
          initialized: status.initialized,
          capturing: status.capturing,
          enabled: status.enabled,
        });
      })
      .catch((error) => {
        logStore.logError('Failed to initialize debug logging', error);
      });

    // Mark app as interactive
    journeys.appLaunch.interactive({
      theme,
      performance: {
        navigation: performance.getEntriesByType('navigation')[0],
      },
    });
  }, []);

  /*
   * React Router applies the root route's `Layout` export itself, wrapping this
   * component. Rendering `<Layout>` here as well would nest a second
   * `<html>/<head>/<body>` inside the first, which React reports as invalid DOM
   * nesting and duplicate-element mounts. Remix v2 required the explicit wrap;
   * React Router 8 does not.
   */
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const detail = error instanceof Error ? error.message : undefined;

  return <AppErrorPage status={status} detail={status === 404 ? undefined : detail} />;
}
