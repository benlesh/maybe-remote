import { test, expect } from '@playwright/test';

test('Enter name and get greeting', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Name').fill('Ben');
  await page.getByText('Greet').click();

  const text = await page.getByTestId('greeting').innerText();
  expect(text).toBe('Hello, Ben!');

  await page.getByLabel('Name').fill('Jerry');
  await page.getByText('Greet').click();
  const text2 = await page.getByTestId('greeting').innerText();
  expect(text2).toBe('Hello, Jerry!');
});

test('Enter numbers to add and get sums', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Values').fill('1 + 2 + 3 + 4');
  await page.getByText('Sum').click();
  const text = await page.getByTestId('sums').innerText();
  expect(text).toBe('1 3 6 10');
});
