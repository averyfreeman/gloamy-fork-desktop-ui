import type { DesktopCapabilities, DesktopRuntime } from '@/lib/platformCapabilities'

interface TauriCore {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
}

declare global {
  interface Window {
    __TAURI__?: { core: TauriCore }
  }
}

const tauriCore = typeof window === 'undefined' ? undefined : window.__TAURI__?.core

function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!tauriCore)
    return Promise.reject(new Error('This command is available only in Gloamy Desktop.'))

  return tauriCore.invoke<T>(command, args)
}

export const desktopCapabilities: DesktopCapabilities | undefined = tauriCore
  ? {
      getDaemonStatus: () => invoke<DesktopRuntime>('get_daemon_status'),
      requestPairingCode: () => invoke<string>('request_pairing_code'),
      getKeepDaemonRunning: () => invoke<boolean>('get_keep_daemon_running'),
      setKeepDaemonRunning: keepRunning => invoke<void>('set_keep_daemon_running', { keepRunning }),
    }
  : undefined

export const isDesktopApp = desktopCapabilities !== undefined
