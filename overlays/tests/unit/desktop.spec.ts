import { afterEach, describe, expect, it, vi } from 'vitest'

describe('desktop bridge', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI__')
    vi.resetModules()
  })

  it('reports daemon status and pairing through typed commands', async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === 'get_daemon_status') {
        return {
          ready: true,
          api_base_url: 'http://127.0.0.1:42617',
          desktop_managed: true,
          gateway_version: '0.2.2',
          error: null,
        }
      }
      return '123456'
    })
    Object.defineProperty(window, '__TAURI__', {
      configurable: true,
      value: { core: { invoke } },
    })

    const desktop = await import('@/lib/desktop')
    expect(desktop.isDesktopApp).toBe(true)
    expect((await desktop.getDaemonStatus()).gateway_version).toBe('0.2.2')
    expect(await desktop.requestPairingCode()).toBe('123456')
    expect(invoke).toHaveBeenCalledWith('get_daemon_status', undefined)
    expect(invoke).toHaveBeenCalledWith('request_pairing_code', undefined)
  })

  it('handles a legacy daemon that does not report a version', async () => {
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

    const desktop = await import('@/lib/desktop')
    expect((await desktop.getDaemonStatus()).gateway_version).toBeUndefined()
  })
})
