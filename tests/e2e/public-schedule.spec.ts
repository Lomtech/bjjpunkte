import { test, expect } from '@playwright/test'

// Default: CSC FFB gym-id (existiert in Production)
const TEST_GYM_ID = process.env.PLAYWRIGHT_GYM_ID ?? '84990643-7159-4261-9aa5-0d097be23d1c'

test('Public Schedule-API antwortet mit gueltigem Gym-ID', async ({ request }) => {
  const res = await request.get(`/api/public/schedule/${TEST_GYM_ID}`)
  expect(res.status()).toBe(200)

  const json = await res.json()
  expect(json.gym).toBeDefined()
  expect(json.gym.name).toBeTruthy()
  expect(Array.isArray(json.classes)).toBe(true)
})

test('Public Schedule-Cache-Header sind gesetzt', async ({ request }) => {
  const res = await request.get(`/api/public/schedule/${TEST_GYM_ID}`)
  expect(res.headers()['cache-control']).toContain('public')
  // x-cache zeigt HIT oder MISS — beide sind valid, nur "vorhanden" pruefen
  expect(res.headers()['x-cache']).toMatch(/HIT|MISS/)
})

test('Public Schedule mit unbekanntem Gym-ID → 404', async ({ request }) => {
  const res = await request.get('/api/public/schedule/00000000-0000-0000-0000-000000000000')
  expect(res.status()).toBe(404)
})

test('Schedule-Page rendert (nur HTML-Smoke)', async ({ page }) => {
  await page.goto(`/schedule/${TEST_GYM_ID}`)
  // Page laedt — egal ob Classes drin sind oder nicht
  await expect(page).toHaveTitle(/Stundenplan|Schedule|Osss/i)
})
