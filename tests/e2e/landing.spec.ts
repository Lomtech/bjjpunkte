import { test, expect } from '@playwright/test'

// Sprint Phase-2 (2026-05-31): Smoke-Test fuer Landing-Page.

test('Landing-Page laedt + zeigt Hero + Footer', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Osss|Gym-Software|Kampfsport/i)

  // Hero ist sichtbar
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

  // Footer-Links vorhanden
  await expect(page.getByRole('link', { name: /Datenschutz/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Impressum/i })).toBeVisible()
})

test('Security-Header sind gesetzt', async ({ request }) => {
  const res = await request.get('/')
  expect(res.status()).toBe(200)
  expect(res.headers()['x-frame-options']).toBe('DENY')
  expect(res.headers()['x-content-type-options']).toBe('nosniff')
  expect(res.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin')
  expect(res.headers()['content-security-policy']).toContain('default-src')
})

test('Datenschutz + Impressum-Pages laden', async ({ page }) => {
  for (const path of ['/datenschutz', '/impressum', '/agb', '/pricing']) {
    const res = await page.goto(path)
    expect(res?.status(), `${path} sollte 200 sein`).toBe(200)
  }
})

test('Health-Endpoint antwortet 200', async ({ request }) => {
  const res = await request.get('/api/health')
  expect(res.status()).toBe(200)
  const json = await res.json()
  expect(json.ok).toBe(true)
})
