import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './Layout.jsx';

const shell = (path = '/create') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="create" element={<h1>Create page</h1>} />
          <Route path="history" element={<h1>History page</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('Layout', () => {
  it('has a skip link that points at the main content', () => {
    shell();
    const skip = screen.getByRole('link', { name: /skip to (main )?content/i });
    expect(skip).toHaveAttribute('href', '#main');
    expect(document.getElementById('main')).toBe(screen.getByRole('main'));
  });

  it('the skip link is the first thing a keyboard user reaches', async () => {
    shell();
    await userEvent.tab();
    expect(screen.getByRole('link', { name: /skip to/i })).toHaveFocus();
  });

  it('renders the routed page inside <main>', () => {
    shell();
    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Create page' })).toBeInTheDocument();
  });

  it('main is programmatically focusable (for focus-on-navigate) but not a tab stop', () => {
    shell();
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1');
  });

  it('the main navigation links home, to a new mystery, and to my cases', () => {
    shell();
    const nav = screen.getByRole('navigation', { name: /main/i });
    expect(within(nav).getByRole('link', { name: /ai mystery room/i })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: /new mystery/i })).toHaveAttribute('href', '/create');
    expect(within(nav).getByRole('link', { name: /my cases/i })).toHaveAttribute('href', '/history');
  });

  it('marks the current page with aria-current', () => {
    shell('/create');
    const nav = screen.getByRole('navigation', { name: /main/i });
    expect(within(nav).getByRole('link', { name: /new mystery/i })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /my cases/i })).not.toHaveAttribute('aria-current');
  });

  it('footer shows the current year', () => {
    shell();
    expect(within(screen.getByRole('contentinfo')).getByText(new RegExp(String(new Date().getFullYear())))).toBeInTheDocument();
  });

  it('has no dead "#" links', () => {
    shell();
    const dead = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '#');
    expect(dead).toEqual([]);
  });

  it('does not steal focus on first load', () => {
    shell();
    expect(screen.getByRole('main')).not.toHaveFocus();
  });

  it('after navigating, scrolls to top and moves focus to the new page', async () => {
    shell('/create');
    await userEvent.click(screen.getByRole('link', { name: /my cases/i }));
    expect(await screen.findByRole('heading', { name: 'History page' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('decorative effects are hidden from assistive tech', () => {
    const { container } = shell();
    const layers = container.querySelectorAll('[data-atmosphere]');
    expect(layers.length).toBeGreaterThan(0);
    layers.forEach((l) => expect(l).toHaveAttribute('aria-hidden', 'true'));
  });
});
