import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { PUBLIC_CASE_EXAMPLE } from '../../api/mock/fixtures.js';
import { setReducedMotion } from '../../test/matchMedia.js';
import { AccuseBar } from './AccuseBar.jsx';
import { CaseHeader } from './CaseHeader.jsx';
import { ClueCard } from './ClueCard.jsx';
import { HintsPanel } from './HintsPanel.jsx';
import { StoryPanel } from './StoryPanel.jsx';
import { SuspectCard } from './SuspectCard.jsx';

afterEach(() => vi.useRealTimers());

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const withRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
const scoreEl = () => screen.getByText('Score if correct now').nextElementSibling.querySelector('[data-score]');
const caseWith = (patch = {}) => ({ ...structuredClone(PUBLIC_CASE_EXAMPLE), ...patch });
const freshProgress = { discoveredCount: 0, totalClues: 5, hintsUsed: 0, hintsTotal: 2 };

describe('CaseHeader', () => {
  it('shows a case number, the title as the page h1 and the difficulty (the setting lives in the story panel)', () => {
    withRouter(<CaseHeader caseData={caseWith()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'The Silent Sitar' })).toBeInTheDocument();
    expect(screen.getByText('CASE #0718')).toBeInTheDocument(); // last 4 of the id, upper-cased
    expect(screen.getByText('Easy')).toHaveAttribute('data-tone', 'easy');
    expect(screen.queryByText('Ravindra Music College, Pune — festival night')).toBeNull();
  });

  it('shows clue progress as an accessible bar, and hints used out of total', () => {
    withRouter(<CaseHeader caseData={caseWith()} />);
    const bar = screen.getByRole('progressbar', { name: /clues found/i });
    expect(bar).toHaveAttribute('aria-valuenow', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
    expect(screen.getByText('Hints used').nextElementSibling).toHaveTextContent('1 / 2');
  });

  it('shows the score preview (base + 5 per clue - 10 per hint), clearly labelled as a preview', () => {
    withRouter(<CaseHeader caseData={caseWith()} />); // easy, 1 clue, 1 hint: 100 + 5 - 10
    expect(scoreEl()).toHaveTextContent(/^95$/);
    expect(scoreEl().parentElement).toHaveTextContent(/preview/i); // the number sits right next to the word "preview"
  });

  it('the preview uses the case difficulty (hard starts from 200)', () => {
    withRouter(<CaseHeader caseData={caseWith({ difficulty: 'hard' })} />); // 200 + 5 - 10
    expect(scoreEl()).toHaveTextContent(/^195$/);
  });

  it('the preview follows the numbers, and never goes below zero', () => {
    const { rerender } = withRouter(<CaseHeader caseData={caseWith({ progress: { ...freshProgress, discoveredCount: 3, hintsUsed: 0 }, hints: { total: 2, used: 0, revealed: [] } })} />);
    expect(scoreEl()).toHaveTextContent(/^115$/);
    rerender(<MemoryRouter><CaseHeader caseData={caseWith({ difficulty: 'easy', progress: { ...freshProgress, hintsUsed: 50 }, hints: { total: 2, used: 50, revealed: [] } })} /></MemoryRouter>);
    expect(scoreEl()).toHaveTextContent(/^0$/);
  });

  it('explains the preview in a tooltip the score is linked to', () => {
    withRouter(<CaseHeader caseData={caseWith()} />);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Preview if your accusation is correct. Final score is calculated by the server.');
    expect(screen.getByRole('button', { name: /about the score preview/i })).toHaveAttribute('aria-describedby', tip.id);
  });

  it('has a "Make an accusation" link to the accusation page', () => {
    withRouter(<CaseHeader caseData={caseWith()} />);
    expect(screen.getByRole('link', { name: /make an accusation/i })).toHaveAttribute('href', '/case/6720c1f0a1b2c3d4e5f60718/accuse');
  });
});

describe('AccuseBar (sticky on phones)', () => {
  it('shows progress and links to the accusation page', () => {
    withRouter(<AccuseBar caseData={caseWith()} />);
    expect(screen.getByRole('link', { name: /make an accusation/i })).toHaveAttribute('href', '/case/6720c1f0a1b2c3d4e5f60718/accuse');
    expect(screen.getByRole('progressbar', { name: /clues found/i })).toHaveAttribute('aria-valuenow', '1');
  });

  it('is only for small screens (hidden from lg up) and is fixed to the bottom', () => {
    const { container } = withRouter(<AccuseBar caseData={caseWith()} />);
    expect(container.firstChild.className).toMatch(/fixed/);
    expect(container.firstChild.className).toMatch(/bottom-0/);
    expect(container.firstChild.className).toMatch(/lg:hidden/);
  });
});

describe('StoryPanel', () => {
  const story = 'The first paragraph of the story.\n\nThe second paragraph, with more detail.';
  const props = { caseId: 'case-1', setting: 'A rainy hill station', crime: 'The pot was poisoned.', story };

  it('shows the setting, the crime in its own highlighted block, and the story in paragraphs', () => {
    render(<StoryPanel {...props} />);
    expect(screen.getByRole('heading', { level: 2, name: /the case file/i })).toBeInTheDocument();
    expect(screen.getByText('A rainy hill station')).toBeInTheDocument();
    const crime = screen.getByText('The pot was poisoned.');
    expect(crime.closest('[data-crime]')).not.toBeNull();
    expect(screen.getByText('The first paragraph of the story.').tagName).toBe('P');
    expect(screen.getByText('The second paragraph, with more detail.').tagName).toBe('P');
  });

  it('a story with no blank lines is still one readable paragraph', () => {
    render(<StoryPanel {...props} story="Just one block of text." />);
    expect(screen.getByText('Just one block of text.')).toBeInTheDocument();
  });

  it('with reduced motion (the test default) there is nothing to skip', () => {
    render(<StoryPanel {...props} />);
    expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
  });

  it('first visit with motion: offers "Skip", and skipping hides it and remembers the case as seen', async () => {
    setReducedMotion(false);
    render(<StoryPanel {...props} />);
    const skip = screen.getByRole('button', { name: /skip/i });
    await userEvent.click(skip);
    expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
    expect(window.sessionStorage.getItem('mr-story-seen:case-1')).toBe('1');
  });

  it('a case you have already seen is not animated again', () => {
    setReducedMotion(false);
    window.sessionStorage.setItem('mr-story-seen:case-1', '1');
    render(<StoryPanel {...props} />);
    expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
    expect(screen.getByText('The first paragraph of the story.')).toBeVisible();
  });

  it('is per case: seeing one case does not skip the next one', () => {
    setReducedMotion(false);
    window.sessionStorage.setItem('mr-story-seen:case-1', '1');
    render(<StoryPanel {...props} caseId="case-2" />);
    expect(screen.getByRole('button', { name: /skip/i })).toBeInTheDocument();
  });

  it('survives storage that throws (private mode)', async () => {
    setReducedMotion(false);
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<StoryPanel {...props} />);
    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(screen.getByText('The first paragraph of the story.')).toBeInTheDocument();
    get.mockRestore();
    set.mockRestore();
  });
});

describe('SuspectCard', () => {
  const suspect = { id: 's2', name: 'Arjun Rao', role: 'Visiting tabla player', description: 'A charming guest artist.', motive: 'Owes a collector.', alibi: 'Went for chai.' };

  it('shows name, role, description, motive and alibi', () => {
    render(<SuspectCard suspect={suspect} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Arjun Rao' })).toBeInTheDocument();
    for (const text of ['Visiting tabla player', 'A charming guest artist.', 'Owes a collector.', 'Went for chai.']) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByText('Motive')).toBeInTheDocument();
    expect(screen.getByText('Alibi')).toBeInTheDocument();
  });

  it('has an initials avatar, hidden from assistive tech (the name is right there)', () => {
    render(<SuspectCard suspect={suspect} />);
    const avatar = screen.getByText('AR');
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
  });

  it.each([['Cher', 'C'], ['  mary   ann lee ', 'ML'], ['Åsa Berg', 'ÅB']])('initials of "%s" are %s', (name, initials) => {
    render(<SuspectCard suspect={{ ...suspect, name }} />);
    expect(document.querySelector('[data-avatar]')).toHaveTextContent(initials);
  });

  it('the avatar colour is seeded by the name: same name same colour, different names differ', () => {
    const hue = (name) => {
      const { unmount } = render(<SuspectCard suspect={{ ...suspect, name }} />);
      const h = document.querySelector('[data-avatar]').style.getPropertyValue('--h');
      unmount();
      return h;
    };
    expect(hue('Arjun Rao')).toBe(hue('Arjun Rao'));
    expect(hue('Arjun Rao')).not.toBe(hue('Meera Iyer'));
    expect(Number(hue('Arjun Rao'))).toBeGreaterThanOrEqual(0);
    expect(Number(hue('Arjun Rao'))).toBeLessThan(360);
  });

  it('on a phone motive and alibi are tucked behind a toggle; the toggle reports its state', async () => {
    render(<SuspectCard suspect={suspect} />);
    const toggle = screen.getByRole('button', { name: /motive and alibi/i });
    const details = document.querySelector('[data-details]');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(details.className).toMatch(/hidden/);
    expect(details.className).toMatch(/lg:block/); // always shown on large screens
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(details.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(toggle.getAttribute('aria-controls')).toBe(details.id);
  });
});

describe('ClueCard', () => {
  const sealed = { id: 'c1', title: 'Rosin smudge', location: 'Green room door', discovered: false, description: null };
  const open = { ...sealed, discovered: true, description: 'A fresh amber smear of rosin.' };

  it('face down: title, location and an Examine button, but no description', () => {
    render(<ClueCard clue={sealed} onExamine={() => Promise.resolve()} />);
    expect(screen.getByText('Rosin smudge')).toBeInTheDocument();
    expect(screen.getByText('Green room door')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /examine/i })).toBeInTheDocument();
    expect(document.querySelector('[data-flip]')).toHaveAttribute('data-flipped', 'false');
    expect(screen.queryByText(/amber smear/)).toBeNull();
  });

  it('already discovered: face up straight away, with the description and no Examine button', () => {
    render(<ClueCard clue={open} onExamine={() => Promise.resolve()} />);
    expect(screen.getByText('A fresh amber smear of rosin.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /examine/i })).toBeNull();
    expect(document.querySelector('[data-flip]')).toHaveAttribute('data-flipped', 'true');
  });

  it('already discovered with motion on: drawn face up at once, not animated from face down', () => {
    setReducedMotion(false);
    render(<ClueCard clue={open} onExamine={() => Promise.resolve()} />);
    expect(document.querySelector('[data-flip]').style.transform).toBe('rotateY(180deg)');
  });

  it('Examine asks the page to examine this clue', async () => {
    const onExamine = vi.fn().mockResolvedValue(undefined);
    render(<ClueCard clue={sealed} onExamine={onExamine} />);
    await userEvent.click(screen.getByRole('button', { name: /examine/i }));
    expect(onExamine).toHaveBeenCalledWith('c1');
  });

  it('while waiting for the server the button is busy and disabled, and a second click does nothing', async () => {
    const d = deferred();
    const onExamine = vi.fn(() => d.promise);
    render(<ClueCard clue={sealed} onExamine={onExamine} />);
    const button = screen.getByRole('button', { name: /examine/i });
    await userEvent.click(button);
    await userEvent.click(button);
    await userEvent.dblClick(button);
    expect(onExamine).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await act(async () => { d.resolve(); await d.promise; });
    expect(button).toBeEnabled();
  });

  it('if examining fails the card stays face down and can be tried again', async () => {
    const onExamine = vi.fn().mockRejectedValueOnce({ code: 'NETWORK' }).mockResolvedValueOnce(undefined);
    render(<ClueCard clue={sealed} onExamine={onExamine} />);
    const button = screen.getByRole('button', { name: /examine/i });
    await userEvent.click(button);
    expect(button).toBeEnabled();
    expect(document.querySelector('[data-flip]')).toHaveAttribute('data-flipped', 'false');
    await userEvent.click(button);
    expect(onExamine).toHaveBeenCalledTimes(2);
  });

  it('when the server reveals the clue the card turns over and the description appears', () => {
    const { rerender } = render(<ClueCard clue={sealed} onExamine={() => Promise.resolve()} />);
    rerender(<ClueCard clue={open} onExamine={() => Promise.resolve()} />);
    expect(screen.getByText('A fresh amber smear of rosin.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /examine/i })).toBeNull();
    expect(document.querySelector('[data-flip]')).toHaveAttribute('data-flipped', 'true');
  });

  it('the Examine button names the clue for screen readers', () => {
    render(<ClueCard clue={sealed} onExamine={() => Promise.resolve()} />);
    expect(screen.getByRole('button', { name: 'Examine clue: Rosin smudge' })).toBeInTheDocument();
  });

  it('with full motion it still ends face up with the text visible (the animation is only decoration)', () => {
    setReducedMotion(false);
    const { rerender } = render(<ClueCard clue={sealed} onExamine={() => Promise.resolve()} />);
    rerender(<ClueCard clue={open} onExamine={() => Promise.resolve()} />);
    expect(screen.getByText('A fresh amber smear of rosin.')).toBeInTheDocument();
    expect(document.querySelector('[data-flip]')).toHaveAttribute('data-flipped', 'true');
  });
});

describe('HintsPanel', () => {
  const hints = (used, revealed = []) => ({ total: 3, used, revealed });
  const two = [{ index: 0, text: 'Think about rosin.' }, { index: 1, text: 'Look at the ledger.' }];

  it('with nothing used yet it says so and explains the price', () => {
    render(<HintsPanel hints={hints(0)} onRequest={() => Promise.resolve()} />);
    expect(screen.getByText(/no hints used yet/i)).toBeInTheDocument();
    expect(screen.getByText(/10 points/i)).toBeInTheDocument();
  });

  it('lists revealed hints in order as "Hint n of total", inside a polite live region', () => {
    render(<HintsPanel hints={hints(2, two)} onRequest={() => Promise.resolve()} />);
    const live = screen.getByRole('list').closest('[aria-live]');
    expect(live).toHaveAttribute('aria-live', 'polite');
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Hint 1 of 3');
    expect(items[0]).toHaveTextContent('Think about rosin.');
    expect(items[1]).toHaveTextContent('Hint 2 of 3');
  });

  it('the button says how many are left', () => {
    render(<HintsPanel hints={hints(1, two.slice(0, 1))} onRequest={() => Promise.resolve()} />);
    expect(screen.getByRole('button', { name: /get a hint/i })).toHaveTextContent(/2 left/i);
  });

  it('asks for confirmation first: the dialog names the next hint and the price, and Cancel does nothing', async () => {
    const onRequest = vi.fn().mockResolvedValue(undefined);
    render(<HintsPanel hints={hints(1, two.slice(0, 1))} onRequest={onRequest} />);
    await userEvent.click(screen.getByRole('button', { name: /get a hint/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/hints cost 10 points/i);
    expect(dialog).toHaveTextContent(/reveal hint 2/i);
    await userEvent.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onRequest).not.toHaveBeenCalled();
  });

  it('Escape also cancels', async () => {
    const onRequest = vi.fn();
    render(<HintsPanel hints={hints(0)} onRequest={onRequest} />);
    await userEvent.click(screen.getByRole('button', { name: /get a hint/i }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onRequest).not.toHaveBeenCalled();
  });

  it('confirming reveals one hint: the request is made once, the dialog closes and the confirm button is busy meanwhile', async () => {
    const d = deferred();
    const onRequest = vi.fn(() => d.promise);
    render(<HintsPanel hints={hints(0)} onRequest={onRequest} />);
    await userEvent.click(screen.getByRole('button', { name: /get a hint/i }));
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: /reveal hint 1/i });
    await userEvent.click(confirm);
    await userEvent.click(confirm);
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    await act(async () => { d.resolve(); await d.promise; });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the dialog even when the request fails (the page shows the error)', async () => {
    const onRequest = vi.fn().mockRejectedValue({ code: 'NETWORK' });
    render(<HintsPanel hints={hints(0)} onRequest={onRequest} />);
    await userEvent.click(screen.getByRole('button', { name: /get a hint/i }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /reveal hint 1/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: /get a hint/i })).toBeEnabled();
  });

  it('when every hint is used the button is disabled and says "No hints left"', () => {
    render(<HintsPanel hints={{ total: 2, used: 2, revealed: two }} onRequest={() => Promise.resolve()} />);
    const button = screen.getByRole('button', { name: /no hints left/i });
    expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: /get a hint/i })).toBeNull();
  });

  it('shows the remaining hints as sealed placeholders, without any of their text', () => {
    render(<HintsPanel hints={hints(1, two.slice(0, 1))} onRequest={() => Promise.resolve()} />);
    expect(screen.getAllByText(/sealed/i)).toHaveLength(2);
    expect(screen.queryByText('Look at the ledger.')).toBeNull();
  });
});
