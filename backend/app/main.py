import asyncio
from datetime import datetime
import pytz
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from app.core.reminders import procesar_y_enviar_recordatorios

app = FastAPI(title=settings.PROJECT_NAME)

app.include_router(api_router, prefix="/api/v1")

# CORS configuration para permitir peticiones desde Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def cron_recordatorios():
    """
    Rutina que se ejecuta en ciclo infinito esperando a que den las 8:00 AM 
    hora de Argentina para disparar el evento de control de deudores.
    """
    tz = pytz.timezone('America/Argentina/Buenos_Aires')
    while True:
        now_ar = datetime.now(tz)
        
        # Validamos si es la hora indicada (8:00 AM)
        if now_ar.hour == 8 and now_ar.minute == 0:
            await procesar_y_enviar_recordatorios()
            # Descansamos mínimo 60 mins para evitar que se lance más de una vez consecutiva
            await asyncio.sleep(3600)
            continue
            
        # Revisión de hora cada 30 segundos
        await asyncio.sleep(30)

@app.on_event("startup")
async def start_reminder_loop():
    # Lanzamos el Cron Worker in background
    asyncio.create_task(cron_recordatorios())

@app.get("/")
def read_root():
    return {"message": f"Bienvenido a la API de {settings.PROJECT_NAME}"}
