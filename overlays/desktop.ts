export interface DesktopRuntime {
  ready: boolean
  api_base_url: string | null
  desktop_managed: boolean
  gateway_version?: string | null
  error: string | null
}

interface TauriCore {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
}

declare global {
  interface Window {
    __TAURI__?: { core: TauriCore }
  }
}

const tauriCore = typeof window === 'undefined' ? undefined : window.__TAURI__?.core

export const isDesktopApp = Boolean(tauriCore)

function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!tauriCore)
    return Promise.reject(new Error('This command is available only in Gloamy Desktop.'))

  return tauriCore.invoke<T>(command, args)
}

export function getDaemonStatus(): Promise<DesktopRuntime> {
  return invoke<DesktopRuntime>('get_daemon_status')
}

export function requestPairingCode(): Promise<string> {
  return invoke<string>('request_pairing_code')
}

export function getKeepDaemonRunning(): Promise<boolean> {
  return invoke<boolean>('get_keep_daemon_running')
}

export function setKeepDaemonRunning(keepRunning: boolean): Promise<void> {
  return invoke<void>('set_keep_daemon_running', { keepRunning })
}
