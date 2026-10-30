import { Link, NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn.js';
import { AccountMenu } from './AccountMenu.jsx';
import { LogoMark } from './LogoMark.jsx';

// NavLink sets aria-current="page" on the active link by itself.
const linkClass = ({ isActive }) =>
  cn(
    'inline-flex min-h-11 items-center whitespace-nowrap rounded-chip px-2.5 text-sm font-medium transition duration-200 sm:px-3',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber',
    isActive ? 'bg-white/[0.07] text-amber' : 'text-mist hover:bg-white/[0.04] hover:text-zinc-100',
  );

export function NavBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-ink/80 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
        {/* aria-label: on very narrow screens the wordmark is hidden, and the link still needs its name */}
        <Link
          to="/"
          aria-label="AI Mystery Room"
          className="-ml-1 inline-flex min-h-11 items-center gap-2.5 rounded-chip px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          <LogoMark className="size-8 text-amber" />
          <span className="hidden whitespace-nowrap font-display text-lg font-bold tracking-tight min-[420px]:inline">AI Mystery Room</span>
        </Link>
        <ul className="flex items-center gap-0.5 sm:gap-1">
          <li><NavLink to="/create" className={linkClass}>New mystery</NavLink></li>
          <li><NavLink to="/history" className={linkClass}>My cases</NavLink></li>
          <li className="ml-1"><AccountMenu /></li>
        </ul>
      </nav>
    </header>
  );
}
