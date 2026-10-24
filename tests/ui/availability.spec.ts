import { test, expect, type Page } from '@playwright/test';
import type { StudentProfile } from '../../src/types';

async function studentSession(page: Page, onboardingComplete = true) {
  // Reproduce the campus LAN HTTP browser API, where randomUUID is absent.
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true });
  });
  let profile: StudentProfile = {
    studentId: 'UR-TEST', fullName: 'Jury Student', homeCampus: 'Rabat', school: 'UM6P',
    interests: ['Robotics'], unavailableBlocks: [], onboardingComplete,
  };
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: {
    user: { id: 'test', studentId: profile.studentId, name: profile.fullName, email: 'jury@example.org', onboardingComplete: profile.onboardingComplete },
  } }));
  await page.route('**/api/profile', (route) => {
    if (route.request().method() === 'PUT') {
      const update = route.request().postDataJSON();
      profile = { ...profile, ...update, onboardingComplete: true,
        unavailableBlocks: update.unavailableBlocks.map((block: object, index: number) => ({ ...block, id: `saved-${index}` })) };
    }
    return route.fulfill({ json: { profile } });
  });
  await page.route('**/api/events', (route) => route.fulfill({ json: { events: [] } }));
  return () => profile;
}

async function addSlot(page: Page, start = '08:00', end = '09:00') {
  await page.getByRole('button', { name: /Add busy time|Add time/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Start time').fill(start);
  await dialog.getByLabel('End time').fill(end);
  await dialog.getByLabel('Activity').fill('Robotics lab');
  await dialog.getByRole('button', { name: 'Add period', exact: true }).click();
}

test('HTTP preview: add, validate, edit, save, reload and delete busy slots', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const saved = await studentSession(page);
  await page.goto('/app/profile');
  await addSlot(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const summary = page.locator('.availability-summary');
  await expect(summary).toContainText('1 unavailable period');
  await addSlot(page, '08:30', '09:30');
  await expect(page.getByRole('alert')).toContainText('overlaps');
  await page.getByRole('dialog').getByLabel('Start time').fill('10:00');
  await page.getByRole('dialog').getByRole('button', { name: 'Add period' }).click();
  await expect(page.getByRole('alert')).toContainText('End time must be later');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await summary.getByRole('button', { name: 'Edit Monday 08:00 block' }).click();
  await page.getByRole('dialog').getByLabel('End time').fill('10:00');
  await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
  await expect(summary).toContainText('08:00–10:00');
  await page.getByRole('button', { name: /Save changes|Save profile/ }).click();
  await expect.poll(() => saved().unavailableBlocks[0]?.endTime).toBe('10:00');
  await page.reload();
  await expect(summary).toContainText('08:00–10:00');
  await summary.getByRole('button', { name: 'Delete Monday 08:00 block' }).click();
  await page.getByRole('button', { name: /Save changes|Save profile/ }).click();
  await expect.poll(() => saved().unavailableBlocks.length).toBe(0);
  await page.reload();
  await expect(summary).toContainText('0 unavailable periods');
  expect(errors).toEqual([]);
});

test('onboarding keeps newly saved slots when opening My Profile immediately', async ({ page }) => {
  const saved = await studentSession(page, false);
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await addSlot(page);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Complete setup' }).click();
  await expect(page).toHaveURL('/app');
  // Client-side navigation deliberately retains the React Query cache.
  if (test.info().project.name === 'mobile') await page.getByRole('button', { name: /Open navigation/ }).click();
  await page.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.locator('.availability-summary')).toContainText('1 unavailable period');
  expect(saved().unavailableBlocks).toHaveLength(1);
});

test('supplied logo and palette load in both themes, including the HTTP chat page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await studentSession(page);
  await page.goto('/app/chat');
  await expect(page.locator('.chat-workspace')).toBeVisible();
  const logo = page.locator('.brand-mark img').first();
  await expect(logo).toHaveAttribute('src', '/uniradar-mark.webp');
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#d93612');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface').trim())).toBe('#1b2735');
  expect(errors).toEqual([]);
});
