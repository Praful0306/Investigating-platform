import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes, Providers } from './App.jsx';

const at = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Providers>
        <AppRoutes />
      </Providers>
    </MemoryRouter>,
  );

describe('routes', () => {
  // keep this one first: it is the only test that sees a page chunk before it has loaded
  it('shows a loading skeleton while a page loads', () => {
    at('/history');
    expect(screen.getByRole('status', { name: /loading page/i })).toBeInTheDocument();
  });

  it.each([
    ['/', 'AI Mystery Room', 'AI Mystery Room — every case is new'],
    ['/create', 'Create a mystery', 'Create a mystery · AI Mystery Room'],
    ['/case/6720c1f0a1b2c3d4e5f60718', 'Investigation room', 'Investigation room · AI Mystery Room'],
    ['/case/6720c1f0a1b2c3d4e5f60718/accuse', 'Make your accusation', 'Make your accusation · AI Mystery Room'],
    ['/case/6720c1f0a1b2c3d4e5f60718/result', 'Case result', 'Case result · AI Mystery Room'],
    ['/login', 'Sign in', 'Sign in · AI Mystery Room'],
    ['/register', 'Create your account', 'Create your account · AI Mystery Room'],
    ['/history', 'My cases', 'My cases · AI Mystery Room'],
  ])('%s renders its page with one h1 and a matching document title', async (path, heading, title) => {
    at(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe(title);
  });

  it('every route sits inside the shared layout (nav, main, footer)', async () => {
    at('/create');
    await screen.findByRole('heading', { level: 1, name: 'Create a mystery' });
    expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('case pages receive their :id', async () => {
    at('/case/abc123');
    expect(await screen.findByText(/case id: abc123/i)).toBeInTheDocument();
  });

  it.each(['/nope', '/case', '/case/abc/unknown', '/create/extra'])('%s -> a friendly 404 with a way home', async (path) => {
    at(path);
    expect(await screen.findByRole('heading', { level: 1, name: /page not found/i })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: /home/i })).toHaveAttribute('href', '/');
    expect(document.title).toBe('Page not found · AI Mystery Room');
  });
});
