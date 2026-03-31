from fastapi import APIRouter
from app.api.v1.endpoints import admin, chofer, openai, webhooks, public, tariffs, reservations, payments

api_router = APIRouter()
api_router.include_router(admin.router, prefix="/admin", tags=["Administración"])
api_router.include_router(chofer.router, prefix="/chofer", tags=["Choferes"])
api_router.include_router(openai.router, prefix="/ai", tags=["Asistente IA"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["Webhooks Evolution"])
api_router.include_router(public.router, prefix="/public", tags=["Endpoints Públicos - Visitas"])
api_router.include_router(tariffs.router, prefix="/tariffs", tags=["Tarifario Dinámico"])
api_router.include_router(reservations.router, prefix="/reservations", tags=["Reservas"])
api_router.include_router(payments.router, prefix="/payments", tags=["Billetera y Pagos MP"])
