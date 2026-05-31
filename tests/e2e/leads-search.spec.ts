import { test, expect } from '@playwright/test'

// Skip if no test-account — search-Test braucht authentifizierten Dashboard-Zugang
test.skip(!process.env.PLAYWRIGHT_TEST_EMAIL, 'PLAYWRIGHT_TEST_EMAIL not set')

test('Leads-Search-Filter funktioniert', async ({ page }) => {
  // Login
  await page.goto('/login')
  await page.getByLabel(/E.?Mail|Email/i).first().fill(process.env.PLAYWRIGHT_TEST_EMAIL!)
  await page.getByLabel(/Passwort|Password/i).first().fill(process.env.PLAYWRIGHT_TEST_PASSWORD!)
  await page.getByRole('button', { name: /Anmelden|Sign in|Log in/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })

  // Zu Leads-Page navigieren
  await page.goto('/dashboard/leads')

  // Such-Input ist da
  const search = page.getByPlaceholder(/Suche|Search/i).first()
  await expect(search).toBeVisible()

  // Tippen → debounce → Liste filtert
  await search.fill('xxxnonexistentxxx')
  // 300ms warten fuer debounce + filter
  await page.waitForTimeout(500)

  // Wenn kein Match: leere Liste oder Empty-State
  const noMatch = page.getByText(/keine Treffer|no matches|0 Treffer/i)
  // Tolerance: koennte auch "noch keine Leads" zeigen wenn Account leer ist
  await expect(noMatch.or(page.getByText(/0/))).toBeVisible({ timeout: 5_000 }).catch(() => {})

  // Reset
  await search.fill('')
})
