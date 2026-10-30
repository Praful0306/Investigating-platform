import { Suspense, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Atmosphere } from '../effects/Atmosphere.jsx';
import { PageSkeleton } from '../ui/PageSkeleton.jsx';
import { Footer } from './Footer.jsx';
import { NavBar } from './NavBar.jsx';

export function Layout() {
  const { pathname } = useLocation();
  const mainRef = useRef(null);
  const lastPath = useRef(pathname);

  // After a client-side navigation: back to the top and focus the new page, so keyboard and screen-reader users
  // land on the new content. Not on first load (nothing to announce) and safe under StrictMode's double effect.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-[80] rounded-chip bg-amber px-4 py-2 font-semibold text-ink focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <Atmosphere />
      <NavBar />
      <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        {/* the Suspense sits here, inside the layout, so the nav stays put while a page chunk loads */}
        <Suspense fallback={<PageSkeleton />}>
          <div key={pathname} className="animate-page-enter">
            <Outlet />
          </div>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
