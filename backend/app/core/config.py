from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_expires_minutes: int = 480
    cors_origins: str = "http://localhost:5173"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url.replace("postgres://", "postgresql://", 1)
        return url.replace("postgresql://", "postgresql+psycopg://", 1)


settings = Settings()
