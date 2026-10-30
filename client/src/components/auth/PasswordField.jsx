import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { passwordStrength } from '../../lib/password.js';
import { cn } from '../../lib/cn.js';
import { TextField } from './TextField.jsx';

const BAR = ['bg-blood', 'bg-amber', 'bg-amber', 'bg-moss'];

// A password box with a show/hide button. `showStrength` (sign-up only) adds a small meter and a word under the box.
export function PasswordField({ showStrength = false, value, ...field }) {
  const [shown, setShown] = useState(false);
  const { level, label } = passwordStrength(value);
  const meter = showStrength && typeof value === 'string' && value.length > 0;

  return (
    <div>
      <TextField {...field} value={value} type={shown ? 'text' : 'password'} inputClassName="pr-12" autoCapitalize="none" spellCheck={false}>
        <button
          type="button"
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
          className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-chip text-mist transition hover:text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-amber"
        >
          {shown ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
        </button>
      </TextField>

      {meter && (
        <div className="mt-2 flex items-center gap-3">
          <div role="meter" aria-label="Password strength" aria-valuemin={0} aria-valuemax={3} aria-valuenow={level} aria-valuetext={label} className="flex flex-1 gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i < level ? BAR[level] : 'bg-white/10')} />
            ))}
          </div>
          <span className="w-16 text-right font-mono text-xs text-mist">{label}</span>
        </div>
      )}
    </div>
  );
}
