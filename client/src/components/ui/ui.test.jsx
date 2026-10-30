import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Link } from 'react-router-dom';
import { Button } from './Button.jsx';
import { Card } from './Card.jsx';
import { Badge } from './Badge.jsx';
import { ProgressBar } from './ProgressBar.jsx';
import { Skeleton } from './Skeleton.jsx';
import { Spinner } from './Spinner.jsx';
import { ErrorState } from './ErrorState.jsx';
import { PageSkeleton } from './PageSkeleton.jsx';
import { cn } from '../../lib/cn.js';

describe('cn', () => {
  it('joins truthy class names and skips the rest', () => {
    expect(cn('a', false, null, undefined, '', 'b', 0, ['d', false, 'e'])).toBe('a b d e');
  });
});

describe('Button', () => {
  it('is a real button that does not submit forms by default', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button');
  });

  it('runs onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(['primary', 'ghost', 'danger'])('has a %s variant', (variant) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', variant);
  });

  it('defaults to primary and lets type="submit" through', () => {
    render(<Button type="submit">x</Button>);
    const b = screen.getByRole('button');
    expect(b).toHaveAttribute('data-variant', 'primary');
    expect(b).toHaveAttribute('type', 'submit');
  });

  it('loading: disabled, aria-busy, spinner shown, clicks ignored, label kept', async () => {
    const onClick = vi.fn();
    const { container } = render(<Button loading onClick={onClick}>Generate</Button>);
    const b = screen.getByRole('button', { name: /generate/i });
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute('aria-busy', 'true');
    expect(container.querySelector('[data-spinner]')).not.toBeNull();
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled buttons do not fire', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>x</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('can render as a link and keeps the look', () => {
    render(<MemoryRouter><Button as={Link} to="/create">Start</Button></MemoryRouter>);
    const a = screen.getByRole('link', { name: 'Start' });
    expect(a).toHaveAttribute('href', '/create');
    expect(a).toHaveAttribute('data-variant', 'primary');
  });

  it('has a visible keyboard focus style and a touch-friendly height', () => {
    render(<Button>x</Button>);
    const cls = screen.getByRole('button').className;
    expect(cls).toMatch(/focus-visible:/);
    expect(cls).toMatch(/min-h-11/); // 44 px
  });

  it('merges a custom className', () => {
    render(<Button className="w-full">x</Button>);
    expect(screen.getByRole('button').className).toMatch(/w-full/);
  });
});

describe('Card', () => {
  it('is felt by default and can be paper', () => {
    const { rerender } = render(<Card data-testid="c">x</Card>);
    expect(screen.getByTestId('c')).toHaveAttribute('data-variant', 'felt');
    rerender(<Card variant="paper" data-testid="c">x</Card>);
    expect(screen.getByTestId('c')).toHaveAttribute('data-variant', 'paper');
  });

  it('renders as another element and applies a tilt only when asked', () => {
    const { rerender } = render(<Card as="article" data-testid="c">x</Card>);
    expect(screen.getByTestId('c').tagName).toBe('ARTICLE');
    expect(screen.getByTestId('c').style.getPropertyValue('--tilt')).toBe('');
    rerender(<Card tilt={-1.5} data-testid="c">x</Card>);
    expect(screen.getByTestId('c').style.getPropertyValue('--tilt')).toBe('-1.5deg');
  });
});

describe('Badge', () => {
  it.each(['easy', 'medium', 'hard', 'neutral', 'success', 'danger'])('%s tone', (tone) => {
    render(<Badge tone={tone}>Label</Badge>);
    expect(screen.getByText('Label')).toHaveAttribute('data-tone', tone);
  });
  it('defaults to neutral', () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText('Label')).toHaveAttribute('data-tone', 'neutral');
  });
});

describe('ProgressBar', () => {
  it('exposes progressbar semantics', () => {
    render(<ProgressBar value={2} max={5} label="Clues found" />);
    const bar = screen.getByRole('progressbar', { name: 'Clues found' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
  });

  it('fills by scaling (transform only)', () => {
    const { container } = render(<ProgressBar value={1} max={4} label="x" />);
    expect(container.querySelector('[data-fill]').style.transform).toBe('scaleX(0.25)');
  });

  it.each([[7, 5, 5, 1], [-3, 5, 0, 0], [Number.NaN, 5, 0, 0], [0, 0, 0, 0]])('clamps value %s of max %s', (value, max, now, scale) => {
    const { container } = render(<ProgressBar value={value} max={max} label="x" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(now));
    expect(container.querySelector('[data-fill]').style.transform).toBe(`scaleX(${scale})`);
  });
});

describe('Skeleton, Spinner, PageSkeleton', () => {
  it('Skeleton is decorative and takes sizing classes', () => {
    render(<Skeleton data-testid="s" className="h-8 w-40" />);
    expect(screen.getByTestId('s')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByTestId('s').className).toMatch(/h-8/);
  });

  it('Spinner announces itself politely and has a custom label', () => {
    render(<Spinner label="Dusting for fingerprints" />);
    const s = screen.getByRole('status');
    expect(s).toHaveTextContent('Dusting for fingerprints');
  });

  it('Spinner defaults to "Loading"', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('PageSkeleton is a named loading region', () => {
    render(<PageSkeleton />);
    expect(screen.getByRole('status', { name: /loading page/i })).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('is an alert that shows the friendly message for an error object', () => {
    render(<ErrorState error={{ code: 'FORBIDDEN', message: 'raw' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('This case file belongs to another detective.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('raw');
  });

  it('shows an explicit message and a custom title', () => {
    render(<ErrorState title="Case not found" message="Try another." />);
    expect(screen.getByRole('heading', { name: 'Case not found' })).toBeInTheDocument();
    expect(screen.getByText('Try another.')).toBeInTheDocument();
  });

  it('has a default title', () => {
    render(<ErrorState message="m" />);
    expect(screen.getByRole('heading')).toHaveTextContent(/something went wrong/i);
  });

  it('Retry calls onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="m" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('no Retry button without onRetry', () => {
    render(<ErrorState message="m" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides Retry when retrying cannot help (e.g. FORBIDDEN) but shows it when it can (NETWORK)', () => {
    const { rerender } = render(<ErrorState error={{ code: 'FORBIDDEN' }} onRetry={() => {}} />);
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
    rerender(<ErrorState error={{ code: 'NETWORK', message: 'Cannot reach the server.' }} onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders extra actions (e.g. "Start a new mystery")', () => {
    render(<ErrorState message="m" actions={<a href="/create">Start a new mystery</a>} />);
    expect(screen.getByRole('link', { name: 'Start a new mystery' })).toBeInTheDocument();
  });
});
