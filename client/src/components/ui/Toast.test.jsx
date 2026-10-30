import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from './Toast.jsx';
import { useToast } from './useToast.js';

let api;
// hands the hook's value to the test from an effect (not during render)
const Grab = ({ onReady = () => {} }) => {
  const ctx = useToast();
  useEffect(() => onReady(ctx));
  return null;
};
const setup = () => render(<ToastProvider><Grab onReady={(ctx) => { api = ctx; }} /></ToastProvider>);

describe('Toast', () => {
  it('shows a message inside a polite live region', () => {
    setup();
    act(() => { api.toast({ title: '+5 clue found', description: 'Rosin smudge' }); });
    const region = screen.getByRole('region', { name: /notifications/i });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('+5 clue found');
    expect(region).toHaveTextContent('Rosin smudge');
  });

  it('the live region exists even before the first toast (so screen readers pick the first one up)', () => {
    setup();
    expect(screen.getByRole('region', { name: /notifications/i })).toHaveAttribute('aria-live', 'polite');
  });

  it('disappears by itself after its duration', () => {
    vi.useFakeTimers();
    setup();
    act(() => { api.toast({ title: 'Saved', duration: 3000 }); });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2999); });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2); });
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('defaults to about four seconds', () => {
    vi.useFakeTimers();
    setup();
    act(() => { api.toast({ title: 'Default' }); });
    act(() => { vi.advanceTimersByTime(3900); });
    expect(screen.getByText('Default')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByText('Default')).toBeNull();
  });

  it('can be dismissed by hand (button has an accessible name)', async () => {
    setup();
    act(() => { api.toast({ title: 'Hello' }); });
    await userEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));
    expect(screen.queryByText('Hello')).toBeNull();
  });

  it('dismiss(id) removes that toast only', () => {
    setup();
    let a;
    act(() => { a = api.toast({ title: 'A' }); api.toast({ title: 'B' }); });
    act(() => api.dismiss(a));
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('shows at most three at once, dropping the oldest', () => {
    setup();
    act(() => { ['1', '2', '3', '4'].forEach((t) => api.toast({ title: `T${t}` })); });
    expect(screen.queryByText('T1')).toBeNull();
    for (const t of ['T2', 'T3', 'T4']) expect(screen.getByText(t)).toBeInTheDocument();
  });

  it('identical messages are shown separately', () => {
    setup();
    act(() => { api.toast({ title: 'Same' }); api.toast({ title: 'Same' }); });
    expect(screen.getAllByText('Same')).toHaveLength(2);
  });

  it.each(['success', 'error', 'info'])('%s tone is marked for styling', (tone) => {
    setup();
    act(() => { api.toast({ title: `x-${tone}`, tone }); });
    expect(screen.getByText(`x-${tone}`).closest('[data-tone]')).toHaveAttribute('data-tone', tone);
  });

  it('toast() returns an id and defaults to info', () => {
    setup();
    let id;
    act(() => { id = api.toast({ title: 'plain' }); });
    expect(id).toBeTruthy();
    expect(screen.getByText('plain').closest('[data-tone]')).toHaveAttribute('data-tone', 'info');
  });

  it('clears its timers on unmount (nothing fires afterwards)', () => {
    vi.useFakeTimers();
    const { unmount } = setup();
    act(() => { api.toast({ title: 'bye', duration: 1000 }); });
    unmount();
    expect(() => act(() => { vi.advanceTimersByTime(5000); })).not.toThrow();
  });

  it('useToast outside the provider fails with a helpful message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Grab />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
