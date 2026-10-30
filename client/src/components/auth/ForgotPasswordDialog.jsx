import { useRef, useState } from 'react';
import { authMessage } from '../../auth/errors.js';
import { isEmail } from '../../lib/validate.js';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import { TextField } from './TextField.jsx';

// "Not found" is deliberately treated as success: the dialog must never reveal which emails have an account.
const LOOKS_LIKE_SUCCESS = new Set(['auth/user-not-found', 'auth/invalid-credential']);

export function ForgotPasswordDialog({ open, onClose, initialEmail = '', resetPassword }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  const close = () => { if (!pending) onClose(); };

  async function send(e) {
    e.preventDefault();
    if (busy.current) return;
    if (!isEmail(email)) { setError(authMessage({ code: 'auth/invalid-email' }).message); return; }
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      if (LOOKS_LIKE_SUCCESS.has(err?.code)) setSent(true);
      else setError(authMessage(err).message);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Reset your password"
      description={sent ? undefined : "Enter your email and we'll send you a link to choose a new password."}
      footer={sent ? (
        <Button onClick={close}>Done</Button>
      ) : (
        <>
          <Button variant="ghost" onClick={close} disabled={pending}>Cancel</Button>
          <Button type="submit" form="forgot-form" loading={pending}>Send reset link</Button>
        </>
      )}
    >
      {sent ? (
        <p role="status" className="text-zinc-200">
          If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. Check your inbox (and your spam folder).
        </p>
      ) : (
        <form id="forgot-form" noValidate onSubmit={send}>
          <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} error={error} />
        </form>
      )}
    </Modal>
  );
}
