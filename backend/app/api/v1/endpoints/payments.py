from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from typing import Dict, Any
from pydantic import BaseModel
import mercadopago
from app.core.config import settings
from app.db.supabase import supabase
from app.core.security import get_current_user, get_current_admin
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Instancia del SDK de Mercado Pago
if settings.MERCADOPAGO_ACCESS_TOKEN:
    sdk = mercadopago.SDK(settings.MERCADOPAGO_ACCESS_TOKEN)
else:
    sdk = None
    logger.warning("Falta MERCADOPAGO_ACCESS_TOKEN en el entorno.")

class PaymentRequest(BaseModel):
    monto: float
    descripcion: str = "Pago de Billetera a la Base"

@router.post("/create_preference")
def create_checkout_preference(data: PaymentRequest, claims: Dict[str, Any] = Depends(get_current_user)):
    """Crea una preferencia de cobro en Mercado Pago para que el chofer abone su deuda."""
    if not sdk:
        raise HTTPException(status_code=500, detail="Mercado Pago no está configurado.")
        
    chofer_id = claims.get("sub")
    
    # Crear la preferencia en Mercado Pago
    preference_data = {
        "items": [
            {
                "id": "item-ID-1234",
                "title": data.descripcion,
                "quantity": 1,
                "unit_price": data.monto,
                "currency_id": "ARS"
            }
        ],
        "payer": {
            "email": claims.get("email", "dummy@email.com")
        },
        # Metadata para que el Webhook sepa a qué chofer impactar el pago
        "external_reference": f"{chofer_id}_{data.monto}",
        # Ajustar la URL de tu backend público para recibir WEBHOOKS (ej: https://api.mi-remiseria.com/v1/payments/webhook)
        # "notification_url": "https://tu-dominio.com/api/v1/payments/webhook",
        "back_urls": {
            "success": "https://viajes-nea.com/chofer", # Ajustar a dominio frontend
            "pending": "https://viajes-nea.com/chofer",
            "failure": "https://viajes-nea.com/chofer"
        },
        "auto_return": "approved"
    }

    try:
        preference_response = sdk.preference().create(preference_data)
        preference = preference_response["response"]
        return {"init_point": preference["init_point"]}
    except Exception as e:
        logger.error(f"Error MP: {e}")
        raise HTTPException(status_code=500, detail="Error al generar link de pago")

@router.post("/webhook")
async def mp_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook que recibe los avisos de pago de Mercado Pago.
    Documentación oficial MP IPN.
    """
    if not sdk:
        return {"status": "ignored"}
        
    try:
        # Extraer parámetros de la URL (ej: /webhook?data.id=12345&type=payment)
        params = dict(request.query_params)
        payment_id = params.get("data.id")
        topic = params.get("type", params.get("topic"))

        if topic == "payment" and payment_id:
            # Consultar el estado real del pago a MP
            payment_info = sdk.payment().get(payment_id)
            payment_data = payment_info["response"]
            
            estado = payment_data.get("status")
            external_reference = payment_data.get("external_reference", "")
            
            if estado == "approved" and external_reference:
                # Extraemos el id del chofer y el monto original
                partes = external_reference.split("_")
                chofer_id = partes[0]
                monto = float(partes[1])
                
                # Despachar proceso asíncrono para acreditar el pago en base de datos
                background_tasks.add_task(acreditar_pago, chofer_id, monto, payment_id)

        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error procesando webhook MP: {e}")
        return {"status": "error"}

def acreditar_pago(chofer_id: str, monto: float, mp_payment_id: str):
    """Lógica de BD para impactar el pago aprobado."""
    try:
        # Evitar pagos duplicados consultando si el MP_ID ya existe
        existe = supabase.table("movimientos_saldo").select("id").eq("mp_payment_id", mp_payment_id).execute()
        if existe.data:
            logger.info("El pago de MP ya fue procesado previamente.")
            return
            
        # 1. Registrar el movimiento positivo
        mov_data = {
            "chofer_id": chofer_id,
            "monto": monto,
            "tipo": "pago_mp",
            "descripcion": f"Abono vía Mercado Pago (ID: {mp_payment_id})",
            "mp_payment_id": mp_payment_id
        }
        supabase.table("movimientos_saldo").insert(mov_data).execute()
        
        # 2. Actualizar el saldo actual en la tabla choferes
        # Al sumar `monto` positivo, aliviamos la deuda
        chofer_req = supabase.table("choferes").select("saldo").eq("id", chofer_id).execute()
        saldo_actual = 0
        if chofer_req.data:
            saldo_actual = chofer_req.data[0].get("saldo", 0)
        
        nuevo_saldo = saldo_actual + monto
        supabase.table("choferes").update({"saldo": nuevo_saldo}).eq("id", chofer_id).execute()
        logger.info(f"Saldo del chofer {chofer_id} acreditado. Nuevo saldo: {nuevo_saldo}")
        
    except Exception as e:
        logger.error(f"Falló la acreditación del pago en BD: {e}")

@router.get("/balance")
def get_chofer_balance(claims: Dict[str, Any] = Depends(get_current_user)):
    """Obtiene el saldo actual del chofer y sus últimos movimientos."""
    chofer_id = claims.get("sub")
    
    # Saldo
    resp_chofer = supabase.table("choferes").select("saldo").eq("id", chofer_id).execute()
    saldo = resp_chofer.data[0].get("saldo", 0) if resp_chofer.data else 0
    
    # Movimientos
    resp_movs = supabase.table("movimientos_saldo").select("*").eq("chofer_id", chofer_id).order("created_at", desc=True).limit(20).execute()
    
    return {
        "saldo": saldo,
        "movimientos": resp_movs.data
    }

@router.post("/admin/charge")
def admin_manual_charge(data: Dict[str, Any], claims: Dict[str, Any] = Depends(get_current_admin)):
    """El Admin carga un castigo/deuda/diaria o un pago manual en efectivo."""
    chofer_id = data.get("chofer_id")
    monto = float(data.get("monto", 0)) # Positivo es abono en efvo, negativo es cargo a deber
    tipo = data.get("tipo", "cargo_manual")
    descripcion = data.get("descripcion", "Cargo admin")
    
    # 1. Registrar movimiento
    supabase.table("movimientos_saldo").insert({
        "chofer_id": chofer_id,
        "monto": monto,
        "tipo": tipo,
        "descripcion": descripcion
    }).execute()
    
    # 2. Actualizar saldo
    chofer_req = supabase.table("choferes").select("saldo").eq("id", chofer_id).execute()
    saldo_actual = chofer_req.data[0].get("saldo", 0) if chofer_req.data else 0
    nuevo_saldo = saldo_actual + monto
    
    supabase.table("choferes").update({"saldo": nuevo_saldo}).eq("id", chofer_id).execute()
    
    return {"status": "ok", "nuevo_saldo": nuevo_saldo}

@router.get("/admin/balances")
def get_all_balances(claims: Dict[str, Any] = Depends(get_current_admin)):
    """El Admin revisa quién le debe plata a la base."""
    # Obtenemos todos los choferes y su saldo actual
    resp = supabase.table("choferes").select("id, nombre, vehiculo, patente, saldo").execute()
    return resp.data
