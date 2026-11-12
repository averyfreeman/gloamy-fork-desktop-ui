import { afterEach, describe, expect, it, vi } from 'vitest'

describe('desktop capability adapter', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI__')
    vi.resetModules()
  })

  it('uses typed commands for daemon status, pairing, and daemon preference', async () => {
    const invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => {
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
        return '123456'
      if (command === 'get_keep_daemon_running')
        return false
      if (command === 'set_keep_daemon_running') {
        expect(args).toEqual({ keepRunning: true })
        return undefined
      }
      throw new Error(`Unexpected desktop command: ${command}`)
    })
    Object.defineProperty(window, '__TAURI__', {
      configurable: true,
      value: { core: { invoke } },
    })

    const platform = await import('@/lib/platform')
    const desktop = platform.desktopCapabilities
    expect(platform.isDesktopApp).toBe(true)
    expect(desktop).toBeDefined()
    if (!desktop)
      throw new Error('Desktop capabilities should be available when Tauri core exists.')

    expect((await desktop.getDaemonStatus()).gateway_version).toBe('0.2.2')
    expect(await desktop.requestPairingCode()).toBe('123456')
    expect(await desktop.getKeepDaemonRunning()).toBe(false)
    await desktop.setKeepDaemonRunning(true)
    expect(invoke.mock.calls).toEqual([
      ['get_daemon_status', undefined],
      ['request_pairing_code', undefined],
      ['get_keep_daemon_running', undefined],
      ['set_keep_daemon_running', { keepRunning: true }],
    ])
  })

  it('keeps gateway version optional for older daemons', async () => {
    const invoke = vi.fn(async () => ({
      ready: true,
      api_base_url: 'http://127.0.0.1:42617',
      desktop_managed: false,
      error: null,
    }))
    Object.defineProperty(window, '__TAURI__', {
      configurable: true,
      value: { core: { invoke } },
    })

    const platform = await import('@/lib/platform')
    const desktop = platform.desktopCapabilities
    expect(desktop).toBeDefined()
    if (!desktop)
      throw new Error('Desktop capabilities should be available when Tauri core exists.')

    expect((await desktop.getDaemonStatus()).gateway_version).toBeUndefined()
  })
})
