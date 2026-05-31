import { test, expect } from '@playwright/test'

test('Register-Form rendert mit Bot-Defense-Elements', async ({ page }) => {
  await page.goto('/register')

  // Form-Fields vorhanden
  await expect(page.getByLabel(/Gym.?Name|Gym name/i)).toBeVisible()
  await expect(page.getByLabel(/E.?Mail|Email/i).first()).toBeVisible()
  await expect(page.getByLabel(/Passwort|Password/i).first()).toBeVisible()

  // Honeypot-Field ist im DOM aber versteckt
  const honeypot = page.locator('input[name="website"]')
  await expect(honeypot).toBeAttached()
  await expect(honeypot).not.toBeVisible()

  // Submit-Button
  await expect(page.getByRole('button', { name: /Gym erstellen|Create gym/i })).toBeVisible()
})

test('Register mit Random-Name-Pattern silent-rejected (Bot-Heuristik)', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel(/Gym.?Name|Gym name/i).fill('tlAoMBMRkOSbbedouICt')   // looks random
  await page.getByLabel(/E.?Mail|Email/i).first().fill('test+rejected@example.com')
  await page.getByLabel(/Passwort|Password/i).first().fill('SuperSecure123456!')
  await page.getByRole('button', { name: /Gym erstellen|Create gym/i }).click()

  // Server returnt {ok:true, pendingConfirmation:true} (silent fake-success)
  // → UI zeigt "Check your inbox" — aber kein User wird angelegt
  await expect(page.getByText(/Check your inbox|E.?Mail.?Postfach pr/i)).toBeVisible({ timeout: 10_000 })
})

test('Honeypot ausgefuellt → silent 200', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel(/Gym.?Name|Gym name/i).fill('Test Gym')
  await page.getByLabel(/E.?Mail|Email/i).first().fill('honeypot@example.com')
  await page.getByLabel(/Passwort|Password/i).first().fill('SuperSecure123456!')
  // Bot fuellt das Hidden-Field aus
  await page.locator('input[name="website"]').fill('http://spam.example.com')
  await page.getByRole('button', { name: /Gym erstellen|Create gym/i }).click()

  await expect(page.getByText(/Check your inbox|E.?Mail.?Postfach pr/i)).toBeVisible({ timeout: 10_000 })
})
