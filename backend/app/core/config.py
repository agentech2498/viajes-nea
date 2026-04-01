from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Viajes-Nea API"
    SUPABASE_URL: str
    SUPABASE_KEY: str
    EVOLUTION_URL: str
    EVOLUTION_API_KEY: str
    OPENAI_API_KEY: str
    GOOGLE_MAPS_API_KEY: str | None = None
    EMERGENCY_PHONE: str | None = None
    MERCADOPAGO_ACCESS_TOKEN: str | None = None
    SUPABASE_JWT_SECRET: str	

    class Config:
        env_file = ".env"

settings = Settings()
