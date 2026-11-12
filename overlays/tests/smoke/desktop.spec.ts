import { expect, test, type Page } from '@playwright/test'

async function installDesktopRuntime(page: Page, authenticated = false) {
  await page.addInitScript((hasToken) => {
    if (hasToken)
      localStorage.setItem('gloamy:auth.json', JSON.stringify({ token: 'test-token' }))
    else
      localStorage.removeItem('gloamy:auth.json')
    Object.defineProperty(window, '__TAURI__', {
      configurable: true,
      value: {
        core: {
          invoke: async (command: string, args?: Record<string, unknown>) => {
            if (command === 'get_daemon_status') {
              return {
                ready: true,
                api_base_url: 'http://127.0.0.1:42617',
                desktop_managed: true,
                gateway_version: '0.2.2',
                error: null,
              }
            }
            if (command === 'request_pairing_code')
              return '654321'
            if (command === 'get_keep_daemon_running')
              return localStorage.getItem('test.keep-daemon-running') === 'true'
            if (command === 'set_keep_daemon_running') {
              localStorage.setItem('test.keep-daemon-running', String(args?.keepRunning))
              return undefined
            }
            throw new Error(`Unexpected desktop command: ${command}`)
          },
        },
      },
    })
  }, authenticated)

  await page.route('**/health', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ paired: true }),
  }))

  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    const body = pathname.endsWith('/status')
      ? {
          provider: 'test-provider',
          model: 'test-model',
          temperature: 0.2,
          uptime_seconds: 1,
          gateway_port: 42617,
          locale: 'en',
          memory_backend: 'markdown',
          paired: true,
          channels: {},
          health: { pid: 1, updated_at: '', uptime_seconds: 1, components: {} },
        }
      : { timeline: [] }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
}

test('desktop pairing recovery fills the existing pairing flow with a one-time code', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 850 })
  await installDesktopRuntime(page)
  await page.goto('/#/authentication')

  await expect(page.getByRole('button', { name: 'Request one-time pairing code' })).toBeVisible()
  await page.getByRole('button', { name: 'Request one-time pairing code' }).click()
  await expect(page.getByLabel('Pairing code')).toHaveValue('654321')
  await expect(page.getByRole('status').getByText('654321')).toBeVisible()
})

test('desktop settings persist the keep-running preference and expose pairing recovery', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 850 })
  await installDesktopRuntime(page, true)
  await page.goto('/#/settings')

  const keepRunning = page.getByRole('checkbox', { name: 'Keep daemon running after closing' })
  await expect(page.getByRole('heading', { name: 'Desktop application' })).toBeVisible()
  await expect(keepRunning).not.toBeChecked()
  await keepRunning.check()

  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Keep daemon running after closing' })).toBeChecked()
  await page.getByRole('button', { name: 'Request one-time pairing code' }).click()
  await expect(page.getByRole('status').getByText('654321')).toBeVisible()
})
