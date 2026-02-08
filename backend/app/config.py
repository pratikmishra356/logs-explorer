from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/logs_explorer"

    # App
    app_port: int = 8003

    # Splunk defaults (used as fallback; per-connection credentials live in DB)
    splunk_host: str = ""
    splunk_cookie: str = ""
    splunk_csrf_token: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
