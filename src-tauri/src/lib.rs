use tauri::{Emitter, Manager};

const SHARE_EXT: &str = ".cs2pb";

fn find_share_file<I: IntoIterator<Item = String>>(args: I) -> Option<String> {
    args.into_iter()
        .skip(1)
        .find(|a| a.to_lowercase().ends_with(SHARE_EXT))
}

/// Path of a .cs2pb file the app was launched with (double-click in Explorer).
#[tauri::command]
fn launch_file() -> Option<String> {
    find_share_file(std::env::args())
}

/// Read a .cs2pb share file from anywhere on disk. Restricted to the share
/// extension so the frontend cannot use it as a general file reader.
#[tauri::command]
fn read_share_file(path: String) -> Result<tauri::ipc::Response, String> {
    if !path.to_lowercase().ends_with(SHARE_EXT) {
        return Err("not a .cs2pb file".into());
    }
    std::fs::read(&path)
        .map(tauri::ipc::Response::new)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = find_share_file(argv) {
                let _ = app.emit("open-share-file", path);
            }
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![launch_file, read_share_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
