import json
import os
from pathlib import Path

from pydantic_settings import BaseSettings


def get_data_dir() -> Path:
    if os.name == "nt":
        base = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
    elif os.uname().sysname == "Darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / "ModelDock"


class Settings(BaseSettings):
    app_name: str = "ModelDock"
    version: str = "0.1.0"
    debug: bool = False

    host: str = "127.0.0.1"
    port: int = 52411

    data_dir: Path = get_data_dir()

    ollama_base_url: str = "http://localhost:11434"
    ollama_keep_alive_enabled: bool = False
    ollama_keep_alive_model: str | None = None
    ollama_keep_alive_duration: str = "-1"

    api_key_prefix: str = "sk-md_"
    bcrypt_cost: int = 12

    model_sync_interval_seconds: int = 300
    ollama_ping_interval_seconds: int = 60

    @property
    def db_path(self) -> Path:
        return self.data_dir / "data" / "modeldock.db"

    @property
    def files_dir(self) -> Path:
        return self.data_dir / "files"

    @property
    def logs_dir(self) -> Path:
        return self.data_dir / "logs"

    def ensure_dirs(self) -> None:
        (self.data_dir / "data").mkdir(parents=True, exist_ok=True)
        self.files_dir.mkdir(parents=True, exist_ok=True)
        self.logs_dir.mkdir(parents=True, exist_ok=True)

    @property
    def local_settings_path(self) -> Path:
        return self.data_dir / "data" / "settings.json"

    def load_local_settings(self) -> None:
        self.ensure_dirs()
        if not self.local_settings_path.exists():
            return

        try:
            payload = json.loads(self.local_settings_path.read_text())
        except (OSError, json.JSONDecodeError):
            return

        ollama_base_url = payload.get("ollama_base_url")
        if isinstance(ollama_base_url, str) and ollama_base_url.strip():
            self.ollama_base_url = ollama_base_url.strip()

        ollama_keep_alive_enabled = payload.get("ollama_keep_alive_enabled")
        if isinstance(ollama_keep_alive_enabled, bool):
            self.ollama_keep_alive_enabled = ollama_keep_alive_enabled

        ollama_keep_alive_model = payload.get("ollama_keep_alive_model")
        if isinstance(ollama_keep_alive_model, str) and ollama_keep_alive_model.strip():
            self.ollama_keep_alive_model = ollama_keep_alive_model.strip()
        elif ollama_keep_alive_model is None:
            self.ollama_keep_alive_model = None

        ollama_keep_alive_duration = payload.get("ollama_keep_alive_duration")
        if isinstance(ollama_keep_alive_duration, str) and ollama_keep_alive_duration.strip():
            self.ollama_keep_alive_duration = ollama_keep_alive_duration.strip()

    def save_local_settings(self) -> None:
        self.ensure_dirs()
        payload = {
            "ollama_base_url": self.ollama_base_url,
            "ollama_keep_alive_enabled": self.ollama_keep_alive_enabled,
            "ollama_keep_alive_model": self.ollama_keep_alive_model,
            "ollama_keep_alive_duration": self.ollama_keep_alive_duration,
        }
        self.local_settings_path.write_text(json.dumps(payload, indent=2))


settings = Settings()
