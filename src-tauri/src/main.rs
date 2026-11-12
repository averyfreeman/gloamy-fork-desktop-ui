mod manager;

use manager::{DesktopManager, DesktopRuntime, DesktopState};
use std::sync::Mutex;
use tauri::menu::{AboutMetadataBuilder, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Manager, RunEvent, State, Wry};

struct GatewayVersionMenuItem(MenuItem<Wry>);

fn gateway_version_menu_label(version: Option<&str>) -> String {
    match version {
        Some(version) => format!("Gateway v{version}"),
        None => "Gateway: Not reported".to_owned(),
    }
}

#[tauri::command]
fn get_daemon_status(
    state: State<'_, DesktopState>,
    gateway_version_item: State<'_, GatewayVersionMenuItem>,
) -> DesktopRuntime {
    let mut manager = state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let runtime = manager.runtime();
    let _ = gateway_version_item.0.set_text(gateway_version_menu_label(
        runtime.gateway_version.as_deref(),
    ));
    runtime
}

#[tauri::command]
fn request_pairing_code(state: State<'_, DesktopState>) -> Result<String, String> {
    state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .request_pairing_code()
}

#[tauri::command]
fn get_keep_daemon_running(state: State<'_, DesktopState>) -> bool {
    state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .keep_running()
}

#[tauri::command]
fn set_keep_daemon_running(
    keep_running: bool,
    state: State<'_, DesktopState>,
) -> Result<(), String> {
    state
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .set_keep_running(keep_running)
}

fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let mut manager = DesktopManager::initialize(app.handle())
                .unwrap_or_else(DesktopManager::unavailable);
            let initial_runtime = manager.runtime();
            let desktop_version = format!("v{}", env!("CARGO_PKG_VERSION"));
            let about_text = format!("About Gloamy Desktop {desktop_version}");
            let about_metadata = AboutMetadataBuilder::new()
                .name(Some("Gloamy Desktop"))
                .version(Some(desktop_version))
                .website(Some("https://gloamy.co"))
                .build();
            let about_item =
                PredefinedMenuItem::about(app, Some(&about_text), Some(about_metadata))?;
            let separator_before_gateway = PredefinedMenuItem::separator(app)?;
            let gateway_version_item = MenuItem::with_id(
                app,
                "gateway-version",
                gateway_version_menu_label(initial_runtime.gateway_version.as_deref()),
                false,
                None::<&str>,
            )?;
            let separator_before_quit = PredefinedMenuItem::separator(app)?;
            let quit_item = PredefinedMenuItem::quit(app, Some("Quit Gloamy"))?;
            let app_menu = Submenu::with_items(
                app,
                "Gloamy",
                true,
                &[
                    &about_item,
                    &separator_before_gateway,
                    &gateway_version_item,
                    &separator_before_quit,
                    &quit_item,
                ],
            )?;
            let menu = Menu::with_items(app, &[&app_menu])?;
            app.set_menu(menu)?;

            app.manage(DesktopState(Mutex::new(manager)));
            app.manage(GatewayVersionMenuItem(gateway_version_item));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_daemon_status,
            request_pairing_code,
            get_keep_daemon_running,
            set_keep_daemon_running
        ])
        .build(tauri::generate_context!())
        .expect("failed to build Gloamy desktop application");

    app.run(|app_handle, event| match event {
        RunEvent::ExitRequested { api, .. } => {
            let state = app_handle.state::<DesktopState>();
            let mut manager = state
                .0
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            if manager.exit_is_allowed() {
                return;
            }

            api.prevent_exit();
            match manager.begin_exit() {
                Ok(()) => app_handle.exit(0),
                Err(error) => manager.set_error(error),
            }
        }
        // Some native quit routes reach event-loop teardown without a usable
        // exit-request callback. Stop an owned daemon as a final cleanup path.
        RunEvent::Exit => {
            let state = app_handle.state::<DesktopState>();
            let mut manager = state
                .0
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            if !manager.exit_is_allowed()
                && let Err(error) = manager.begin_exit()
            {
                eprintln!("could not stop the managed Gloamy daemon during app exit: {error}");
            }
        }
        _ => {}
    });
}

#[cfg(test)]
mod tests {
    use super::gateway_version_menu_label;

    #[test]
    fn about_menu_reports_desktop_gateway_version_or_fallback() {
        assert_eq!(gateway_version_menu_label(Some("0.2.2")), "Gateway v0.2.2");
        assert_eq!(gateway_version_menu_label(None), "Gateway: Not reported");
    }
}
