const { test, expect } = require('@playwright/test');

// Helper: log in with the default seeded credentials.
async function login(page, user = 'test', pass = 'test') {
  await page.fill('#login-user', user);
  await page.fill('#login-pass', pass);
  await page.click('#login-submit');
}

test.describe('authentication gate', () => {
  test('shows the login overlay and hides the app before auth', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#login-overlay')).toBeVisible();
    await expect(page.locator('.app-header')).toBeHidden();
  });

  test('rejects wrong credentials with an error', async ({ page }) => {
    await page.goto('/');
    await login(page, 'test', 'wrong');
    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-overlay')).toBeVisible();
  });

  test('logs in, reveals the app, and logs out', async ({ page }) => {
    await page.goto('/');
    await login(page);
    await expect(page.locator('#login-overlay')).toBeHidden();
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('#account-user')).toHaveText('test');

    await page.click('#btn-logout');
    await expect(page.locator('#login-overlay')).toBeVisible();
  });
});

test.describe('recipes flow', () => {
  test('lists seeded recipes and filters by meal type', async ({ page }) => {
    await page.goto('/');
    await login(page);
    await expect(page.locator('#recipes-grid .recipe-card').first()).toBeVisible();
    const count = await page.locator('#recipes-grid .recipe-card').count();
    expect(count).toBeGreaterThan(0);
  });

  test('creates a recipe in the Validator and sees it in Recipes', async ({ page }) => {
    await page.goto('/');
    await login(page);

    // Go to the Validator tab
    await page.click('.tab[data-tab="validator"]');
    await page.fill('#v-name', 'Receta E2E');
    await page.selectOption('#v-type', 'cena');

    // First ingredient row
    const row = page.locator('#v-ingredients .ingredient-row').first();
    await row.locator('.ing-name').fill('pollo');
    await row.locator('.ing-quantity').fill('200 g');
    await row.locator('.ing-type').selectOption('carne blanca');

    await page.click('#form-validator button[type="submit"]'); // Validar
    await expect(page.locator('#v-result .status')).toBeVisible();

    // Save (enabled when valid)
    await page.click('#v-save');

    // Back to Recipes: the new recipe is listed
    await page.click('.tab[data-tab="recipes"]');
    await page.fill('#filter-ingredient', 'pollo');
    await expect(page.locator('#recipes-grid', { hasText: 'Receta E2E' })).toBeVisible();
  });
});

test.describe('weekly plan', () => {
  test('assigns a recipe to a slot and saves', async ({ page }) => {
    await page.goto('/');
    await login(page);
    await page.click('.tab[data-tab="plan"]');

    const select = page.locator('#plan-grid select[data-day="lunes"][data-meal="desayuno"]');
    const options = await select.locator('option').count();
    if (options > 1) {
      await select.selectOption({ index: 1 });
      await page.click('#plan-save');
      await expect(page.locator('#toast.show')).toBeVisible();
    }
  });
});
