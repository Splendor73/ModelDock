use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, State};

const DEFAULT_BACKEND_PORT: u16 = 52411;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackendStateResponse {
    base_url: String,
    port: u16,
    data_dir: String,
    running: bool,
}

struct BackendManager {
    backend_dir: PathBuf,
    python_path: PathBuf,
    data_dir: PathBuf,
    logs_dir: PathBuf,
    port_file: PathBuf,
    port: u16,
    child: Option<Child>,
}

struct AppState {
    backend: Mutex<BackendManager>,
}

impl BackendManager {
    fn new(data_dir: PathBuf) -> Result<Self, String> {
        let project_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "Could not resolve project root".to_string())?;
        let backend_dir = project_root.join("backend");
        let python_path = backend_dir.join("venv").join("bin").join("python");
        let logs_dir = data_dir.join("logs");
        let port_file = data_dir.join(".port");

        fs::create_dir_all(&logs_dir).map_err(|error| error.to_string())?;

        Ok(Self {
            backend_dir,
            python_path,
            data_dir,
            logs_dir,
            port_file,
            port: DEFAULT_BACKEND_PORT,
            child: None,
        })
    }

    fn ensure_running(&mut self) -> Result<(), String> {
        if self.is_running() {
            return Ok(());
        }
        self.start()
    }

    fn is_running(&mut self) -> bool {
        match self.child.as_mut() {
            Some(child) => match child.try_wait() {
                Ok(None) => true,
                Ok(Some(_)) | Err(_) => {
                    self.child = None;
                    false
                }
            },
            None => false,
        }
    }

    fn state(&mut self) -> BackendStateResponse {
        BackendStateResponse {
            base_url: format!("http://127.0.0.1:{}", self.port),
            port: self.port,
            data_dir: self.data_dir.display().to_string(),
            running: self.is_running(),
        }
    }

    fn start(&mut self) -> Result<(), String> {
        if self.is_running() {
            return Ok(());
        }

        if !self.python_path.exists() {
            return Err(format!(
                "Python runtime not found at {}",
                self.python_path.display()
            ));
        }

        let port = pick_port(DEFAULT_BACKEND_PORT)?;
        let stdout = open_log_file(&self.logs_dir.join("backend.log"))?;
        let stderr = open_log_file(&self.logs_dir.join("backend.log"))?;

        let child = Command::new(&self.python_path)
            .current_dir(&self.backend_dir)
            .arg("-m")
            .arg("uvicorn")
            .arg("app.main:app")
            .arg("--host")
            .arg("127.0.0.1")
            .arg("--port")
            .arg(port.to_string())
            .stdout(Stdio::from(stdout))
            .stderr(Stdio::from(stderr))
            .spawn()
            .map_err(|error| error.to_string())?;

        self.port = port;
        self.child = Some(child);
        fs::write(&self.port_file, format!("{port}")).map_err(|error| error.to_string())?;
        Ok(())
    }

    fn restart(&mut self) -> Result<(), String> {
        self.stop();
        self.start()
    }

    fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

fn resolve_data_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|error| error.to_string())?;
        return Ok(PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("ModelDock"));
    }

    #[cfg(target_os = "windows")]
    {
        let app_data = std::env::var("APPDATA").map_err(|error| error.to_string())?;
        return Ok(PathBuf::from(app_data).join("ModelDock"));
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let home = std::env::var("HOME").map_err(|error| error.to_string())?;
        return Ok(PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("ModelDock"));
    }
}

fn pick_port(preferred_port: u16) -> Result<u16, String> {
    if TcpListener::bind(("127.0.0.1", preferred_port)).is_ok() {
        return Ok(preferred_port);
    }

    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|error| error.to_string())?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    Ok(port)
}

fn open_log_file(path: &Path) -> Result<std::fs::File, String> {
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn get_backend_state(state: State<'_, AppState>) -> Result<BackendStateResponse, String> {
    let mut backend = state.backend.lock().map_err(|error| error.to_string())?;
    if let Err(error) = backend.ensure_running() {
        if !backend.is_running() {
            return Err(error);
        }
    }
    Ok(backend.state())
}

#[tauri::command]
fn restart_backend(state: State<'_, AppState>) -> Result<BackendStateResponse, String> {
    let mut backend = state.backend.lock().map_err(|error| error.to_string())?;
    backend.restart()?;
    Ok(backend.state())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = resolve_data_dir()?;
            let mut backend = BackendManager::new(data_dir)?;
            let _ = backend.start();
            app.manage(AppState {
                backend: Mutex::new(backend),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_backend_state, restart_backend])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            let state: State<'_, AppState> = app_handle.state();
            let lock_result = state.backend.lock();
            if let Ok(mut backend) = lock_result {
                backend.stop();
            }
        }
    });
}
