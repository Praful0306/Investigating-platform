import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, FolderOpen, LogOut } from 'lucide-react';
import { useAuth } from '../../context/useAuth.js';
import { hueOf, initialsOf } from '../../lib/avatar.js';
import { cn } from '../../lib/cn.js';
import { useToast } from '../ui/useToast.js';

const itemClass =
  'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-chip px-3 text-left text-sm font-medium text-zinc-200 transition hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber';

// The right-hand end of the navigation bar: nothing while the sign-in service starts (so nothing flashes), nothing at
// all when the site has no sign-in, "Sign in" for a guest, and an account menu for someone signed in.
export function AccountMenu() {
  const { status, user, signOut } = useAuth();
  const { toast } = useToast();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const button = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const key = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  if (status === 'signedOut') {
    const here = pathname === '/' || pathname === '/login' || pathname === '/register';
    return (
      <Link
        to={here ? '/login' : `/login?next=${encodeURIComponent(pathname)}`}
        className="inline-flex min-h-11 items-center whitespace-nowrap rounded-chip border border-amber/50 px-3 text-sm font-semibold text-amber transition hover:bg-amber/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        Sign in
      </Link>
    );
  }
  if (status !== 'signedIn') return null;

  const hue = hueOf(user.displayName);
  async function leave() {
    setOpen(false);
    try {
      await signOut();
    } catch {
      toast({ title: "Couldn't sign you out", description: 'Check your connection and try again.', tone: 'error' });
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={`Account menu for ${user.displayName}`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-chip px-1.5 transition hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
      >
        <span
          data-avatar
          aria-hidden="true"
          style={{ '--h': hue, '--h2': (hue + 40) % 360 }}
          className="grid size-9 place-items-center rounded-full bg-[linear-gradient(135deg,hsl(var(--h)_55%_42%),hsl(var(--h2)_60%_26%))] font-display text-sm font-bold text-white"
        >
          {initialsOf(user.displayName)}
        </span>
        <ChevronDown aria-hidden="true" className={cn('size-4 text-mist transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div id={menuId} role="menu" aria-label="Account" className="surface-felt absolute right-0 top-full z-50 mt-2 w-64 p-2 shadow-card">
          <div className="border-b border-edge px-3 pb-3 pt-2">
            <p className="truncate font-medium text-zinc-100">{user.displayName}</p>
            {user.email && <p className="truncate text-xs text-mist">{user.email}</p>}
          </div>
          <div className="pt-2">
            <Link role="menuitem" to="/history" onClick={() => setOpen(false)} className={itemClass}>
              <FolderOpen aria-hidden="true" className="size-4 text-amber" /> My cases
            </Link>
            <button type="button" role="menuitem" onClick={leave} className={itemClass}>
              <LogOut aria-hidden="true" className="size-4 text-amber" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
