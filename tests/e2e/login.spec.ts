import { test, expect } from '@playwright/test'

test('Login-Page rendert + Form-Elements', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel(/E.?Mail|Email/i).first()).toBeVisible()
  await expect(page.getByLabel(/Passwort|Password/i).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Anmelden|Sign in|Log in/i })).toBeVisible()
})

test('Login mit falschen Credentials → Fehler-Toast', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/E.?Mail|Email/i).first().fill('nicht-existent@example.com')
  await page.getByLabel(/Passwort|Password/i).first().fill('wrong-password')
  await page.getByRole('button', { name: /Anmelden|Sign in|Log in/i }).click()

  // Error-Message sichtbar — entweder "Invalid login credentials" oder uebersetzt
  await expect(page.getByText(/Invalid|falsch|fehl|ungueltig/i).first()).toBeVisible({ timeout: 10_000 })
})

// Optional: login-flow mit echtem Test-User wenn PLAYWRIGHT_TEST_EMAIL gesetzt
test('Login mit Test-User → /dashboard erreichbar', async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_TEST_EMAIL, 'PLAYWRIGHT_TEST_EMAIL not set')
  await page.goto('/login')
  await page.getByLabel(/E.?Mail|Email/i).first().fill(process.env.PLAYWRIGHT_TEST_EMAIL!)
  await page.getByLabel(/Passwort|Password/i).first().fill(process.env.PLAYWRIGHT_TEST_PASSWORD!)
  await page.getByRole('button', { name: /Anmelden|Sign in|Log in/i }).click()

  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
  await expect(page.getByText(/Dashboard|Mitglieder|Members/i).first()).toBeVisible()
})
