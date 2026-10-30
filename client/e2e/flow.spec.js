import { expect, test } from '@playwright/test';

// The real client, the real server, the mock AI (the same fixed mystery every time: culprit s2 "Arjun Rao",
// whose explanation carries the marker MOCK_SECRET_EXPLANATION).
const SECRET = 'MOCK_SECRET_EXPLANATION';
const CASE_URL = /\/case\/[0-9a-f]{24}$/;

async function generate(page, difficulty) {
  await page.goto('/');
  await page.getByRole('link', { name: /start a mystery/i }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Create a mystery' })).toBeVisible();
  await page.getByRole('button', { name: 'A vanished sitar at a music festival' }).click();
  await page.getByRole('radio', { name: new RegExp(difficulty, 'i') }).check({ force: true });
  await page.getByRole('button', { name: /generate mystery/i }).click();
  await page.waitForURL(CASE_URL, { timeout: 30_000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

async function takeOneHint(page) {
  await page.getByRole('button', { name: /get a hint/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /reveal hint 1/i }).click();
  await expect(page.getByText('Hint 1 of 2')).toBeVisible();
}

async function accuse(page, name) {
  await page.getByRole('link', { name: /make an accusation/i }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Make your accusation' })).toBeVisible();
  await page.getByRole('radio', { name: new RegExp(name) }).check({ force: true });
  await page.getByRole('button', { name: /^accuse$/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /confirm accusation/i }).click();
  await page.waitForURL(/\/result$/);
}

test('easy case, full flow: 2 clues, 1 hint, right suspect -> SOLVED with 100 points', async ({ page }) => {
  // every /api response seen before the accusation request must be free of the solution
  let accusing = false;
  const seenBeforeAccusation = [];
  page.on('request', (req) => { if (/\/api\/cases\/[^/]+\/accuse$/.test(req.url()) && req.method() === 'POST') accusing = true; });
  page.on('response', async (res) => {
    if (accusing || !res.url().includes('/api/')) return;
    seenBeforeAccusation.push(await res.text().catch(() => ''));
  });

  await generate(page, 'easy');
  const suspects = page.getByRole('region', { name: /suspects/i });
  await expect(suspects.getByRole('heading', { level: 3 })).toHaveCount(3);
  await expect(page.getByRole('button', { name: /examine clue/i })).toHaveCount(5);

  await page.getByRole('button', { name: /examine clue/i }).first().click();
  await expect(page.getByRole('button', { name: /examine clue/i })).toHaveCount(4);
  await page.getByRole('button', { name: /examine clue/i }).first().click();
  await expect(page.getByRole('button', { name: /examine clue/i })).toHaveCount(3);
  await takeOneHint(page);

  await accuse(page, 'Arjun Rao');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Case closed — you got it!');
  await expect(page.locator('[data-total]')).toHaveText('100', { timeout: 10_000 }); // 100 + 2*5 - 1*10
  await expect(page.getByText(new RegExp(SECRET))).toBeVisible(); // the explanation arrives only now

  expect(seenBeforeAccusation.length).toBeGreaterThan(3); // the check really looked at something
  for (const body of seenBeforeAccusation) {
    expect(body).not.toContain(SECRET);
    expect(body).not.toMatch(/culpritId|keyClueIds|"solution"|"explanation"/);
  }
});

test('medium case, wrong suspect -> UNSOLVED, base 0, the clues still count', async ({ page }) => {
  await generate(page, 'medium');
  await expect(page.getByRole('button', { name: /examine clue/i })).toHaveCount(7);
  await page.getByRole('button', { name: /examine clue/i }).first().click();
  await expect(page.getByRole('button', { name: /examine clue/i })).toHaveCount(6);

  await accuse(page, 'Meera Iyer');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The culprit got away.');
  const score = page.getByRole('table', { name: /score breakdown/i });
  await expect(score.getByRole('row', { name: /base/i })).toContainText('0');
  await expect(score.getByRole('row', { name: /clues/i })).toContainText('+5');
  await expect(page.locator('[data-total]')).toHaveText('5', { timeout: 10_000 });
});

test('reloading a finished case lands on its result, and the room redirects there too', async ({ page }) => {
  await generate(page, 'easy');
  const room = page.url();
  await accuse(page, 'Arjun Rao');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Case closed — you got it!');
  await page.goto(room);
  await page.waitForURL(/\/result$/);
  await page.goto(`${room}/accuse`);
  await page.waitForURL(/\/result$/);
});

test('a finished case shows up in My cases, with its score', async ({ page }) => {
  await generate(page, 'easy');
  await page.getByRole('button', { name: /examine clue/i }).first().click();
  await expect(page.getByRole('button', { name: /examine clue/i })).toHaveCount(4);
  await accuse(page, 'Arjun Rao');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'My cases' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'My cases' })).toBeVisible();
  const row = page.getByRole('link', { name: /The Silent Sitar|./ }).filter({ hasText: /pts/ }).first();
  await expect(row).toContainText('Solved');
  await expect(row).toContainText('105 pts'); // 100 + 1 clue * 5
  // this test site has no Firebase settings, so there is no sign-in to offer: no "sign in to keep these" banner
  await expect(page.getByText(/playing as a guest/i)).toHaveCount(0);
});

test('someone else\'s case is refused: a different browser gets "Not your case file"', async ({ page, browser }) => {
  await generate(page, 'easy');
  const id = page.url().match(/case\/([0-9a-f]{24})/)[1];
  const stranger = await browser.newContext();
  const other = await stranger.newPage();
  await other.goto(`/case/${id}`);
  await expect(other.getByRole('heading', { level: 2, name: 'Not your case file' })).toBeVisible();
  await stranger.close();
});

test.describe('on a phone (375 x 812)', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('the sticky Accuse bar is there and the whole flow works', async ({ page }) => {
    await generate(page, 'easy');
    await expect(page.locator('[data-accuse-bar]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await page.getByRole('button', { name: /examine clue/i }).first().scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /examine clue/i }).first().click();
    await expect(page.getByRole('button', { name: /examine clue/i })).toHaveCount(4);

    await page.locator('[data-accuse-bar]').getByRole('link', { name: /make an accusation/i }).click();
    await page.getByRole('radio', { name: /Arjun Rao/ }).check({ force: true });
    await page.getByRole('button', { name: /^accuse$/i }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /^accuse$/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /confirm accusation/i }).click();
    await page.waitForURL(/\/result$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Case closed — you got it!');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
