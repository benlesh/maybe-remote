import { test, expect } from '@playwright/test';

// This tests returning a promise from a service method
test('Enter name and get greeting', async ({ page }) => {
  await page.goto('/');
  const promiseTest = await page.getByTestId('promise-test');

  await promiseTest.getByLabel('Name').fill('Ben');
  await promiseTest.getByText('Greet').click();

  const text = await promiseTest.getByTestId('greeting').innerText();
  expect(text).toBe('Hello, Ben!');

  await promiseTest.getByLabel('Name').fill('Jerry');
  await promiseTest.getByText('Greet').click();
  const text2 = await promiseTest.getByTestId('greeting').innerText();
  expect(text2).toBe('Hello, Jerry!');
});

// This tests async iteration over a service method
test('Enter numbers to add and get sums', async ({ page }) => {
  await page.goto('/');

  const iterableTest = await page.getByTestId('iterable-test');

  await iterableTest.getByLabel('Values').fill('1 + 2 + 3 + 4');
  await iterableTest.getByText('Sum Via Iterable').click();
  const text = await iterableTest.getByTestId('iterable-sums').innerText();
  expect(text).toBe('1 3 6 10');
});

test('Enter numbers to add and get sums over observable', async ({ page }) => {
  await page.goto('/');

  const rxjsTest = await page.getByTestId('rxjs-test');

  await rxjsTest.getByLabel('Values').fill('1 + 2 + 3 + 4');
  await rxjsTest.getByText('Sum Via Observable').click();
  const text = await rxjsTest.getByTestId('observable-sums').innerText();
  expect(text).toBe('1 3 6 10');
});
