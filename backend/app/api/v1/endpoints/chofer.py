from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from typing import Dict, Any, List
from app.core.security import get_current_chofer
from app.db.supabase import supabase
from app.schemas.domain import Viaje, Promocion
from app.core.evolution import send_whatsapp_message
from app.core.config import settings
import datetime

router = APIRouter()

@router.get("/viajes/asignados", response_model=List[Viaje])
def list_viajes(claims: Dict[str, Any] = Depends(get_current_chofer)):
    """
    Obtener viajes asignados al chofer autenticado.
    """
    chofer_user_id = claims.get("sub")
    # Para más optimización, se buscaría en la DB el profile del chofer.
    # Dado que los roles están vinculados, usaremos el usuario_id del chofer.
    
    response = supabase.table("choferes").select("id").eq("usuario_id", chofer_user_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Perfíl de chofer no encontrado.")
    
    chofer_pk = response.data[0]["id"]
    
    viajes_resp = supabase.table("viajes").select("*").eq("chofer_id", chofer_pk).execute()
    return viajes_resp.data

@router.get("/promociones/recompensas", response_model=List[Promocion])
def list_promociones(claims: Dict[str, Any] = Depends(get_current_chofer)):
    """
    Muestra la pestaña de promociones y beneficios asociados a la remisería del chofer actual.
    """
    org_id = claims.get("organizacion_id")
    promos_resp = supabase.table("promociones").select("*").eq("organizacion_id", org_id).execute()
    return promos_resp.data

@router.post("/ubicacion/actualizar")
def update_ubicacion(lat: float, lng: float, claims: Dict[str, Any] = Depends(get_current_chofer)):
    chofer_user_id = claims.get("sub")
    
    # 1. Buscar chofer ID
    c_resp = supabase.table("choferes").select("id").eq("usuario_id", chofer_user_id).execute()
    if not c_resp.data:
        raise HTTPException(status_code=404, detail="Chofer no hallado.")
    c_id = c_resp.data[0]["id"]
    
    # 2. Update lat & lng
    u_resp = supabase.table("choferes").update({"lat": lat, "lng": lng}).eq("id", c_id).execute()
    return {"message": "Ubicación actualizada."}

@router.post("/viajes/{viaje_id}/notificar-aceptacion")
def notificar_aceptacion(viaje_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    chofer_user_id = claims.get("sub")
    
    # 1. Obtener datos del viaje
    v_resp = supabase.table("viajes").select("*").eq("id", viaje_id).execute()
    if not v_resp.data:
         raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    
    viaje = v_resp.data[0]
    origen_data = viaje.get("origen", {})
    pasajero_phone = origen_data.get("cliente_telefono")
    ai_instance = origen_data.get("ai_instance", "viajesnea") # Fallback
    origen_dir = origen_data.get("direccion", "tu ubicación")
    
    if not pasajero_phone:
         return {"message": "Sin telefono de contacto", "sent": False}
    
    # 2. Obtener Nombre del Chofer (de usuarios) y Auto (de choferes)
    usr_resp = supabase.table("usuarios").select("nombre").eq("id", chofer_user_id).execute()
    chofer_nombre = usr_resp.data[0]["nombre"] if usr_resp.data else "Tu Chofer"
    
    chf_resp = supabase.table("choferes").select("vehiculo, patente").eq("usuario_id", chofer_user_id).execute()
    auto_info = ""
    if chf_resp.data:
        vehiculo = chf_resp.data[0].get("vehiculo", "Auto")
        patente = chf_resp.data[0].get("patente", "N/A")
        auto_info = f"en un *{vehiculo}* (Patente: *{patente}*)"
    
    mensaje = f"✅ ¡Tu viaje en {origen_dir} fue aceptado!\n\nTu chofer asignado es *{chofer_nombre}* {auto_info}. Llegará en breve.\n\n📍 *Sigue tu viaje en vivo aquí:*\nhttps://viajesnea.agentech.ar/track/{viaje_id}\n\n👉 Aguarda relajado en el punto de encuentro."
    
    # 3. Disparar WhatsApp en segundo plano para no demorar la respuesta
    background_tasks.add_task(send_whatsapp_message, ai_instance, pasajero_phone, mensaje)
    
    return {"message": "Notificación puesta en cola", "sent": True}

from app.core.evolution import send_whatsapp_list_message

@router.post("/viajes/{viaje_id}/finalizar")
def finalizar_viaje(viaje_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    """
    Finaliza el viaje en la base de datos y descuenta comisión si aplica.
    """
    chofer_user_id = claims.get("sub")
    
    # 1. Obtener datos del viaje y chofer
    v_resp = supabase.table("viajes").select("*, choferes(*)").eq("id", viaje_id).execute()
    if not v_resp.data:
         raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    
    viaje = v_resp.data[0]
    chofer_data = viaje.get("choferes")
    
    if viaje["estado"] == "finalizado":
        return {"message": "Viaje ya finalizado anteriormente."}

    # 2. Actualizar estado del viaje
    supabase.table("viajes").update({"estado": "finalizado"}).eq("id", viaje_id).execute()
    
    # 3. Lógica de Billetera Virtual (Comisión)
    if chofer_data and chofer_data.get("tipo_pago") == "comision":
        precio = float(viaje.get("precio", 0))
        pct_comision = float(chofer_data.get("valor_pago", 0))
        deduccion = precio * (pct_comision / 100)
        
        nuevo_saldo = float(chofer_data.get("saldo", 0)) - deduccion
        supabase.table("choferes").update({"saldo": nuevo_saldo}).eq("id", chofer_data["id"]).execute()

    # 4. Disparar notificaciones (re-uso de lógica de WhatsApp)
    notificar_finalizacion(viaje_id, background_tasks, claims)
    
    return {"message": "Viaje finalizado y comisión descontada.", "nuevo_estado": "finalizado"}

@router.post("/viajes/{viaje_id}/notificar-finalizacion")
def notificar_finalizacion(viaje_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    # 1. Obtener datos del viaje
    v_resp = supabase.table("viajes").select("*").eq("id", viaje_id).execute()
    if not v_resp.data:
         return {"message": "Viaje no encontrado para notificar"}
    
    viaje = v_resp.data[0]
    origen_data = viaje.get("origen", {})
    pasajero_phone = origen_data.get("cliente_telefono")
    ai_instance = origen_data.get("ai_instance", "viajesnea")
    
    if not pasajero_phone:
         return {"message": "Sin telefono de contacto", "sent": False}
    
    # Mensajes de WhatsApp
    cierre_msg = "🚗 Tu viaje ha finalizado. ¡Gracias por confiar en nosotros!"
    background_tasks.add_task(send_whatsapp_message, ai_instance, pasajero_phone, cierre_msg)
    
    title = "⭐ ¡Tu opinión cuenta!"
    description = "Por favor, califica la atención del chofer."
    button_text = "Calificar"
    sections = [
        {
            "title": "Calificación",
            "rows": [
                {"title": "5 Estrellas", "rowId": f"rate_5_{viaje_id}"},
                {"title": "4 Estrellas", "rowId": f"rate_4_{viaje_id}"},
                {"title": "3 Estrellas", "rowId": f"rate_3_{viaje_id}"},
                {"title": "2 Estrellas", "rowId": f"rate_2_{viaje_id}"},
                {"title": "1 Estrella", "rowId": f"rate_1_{viaje_id}"}
            ]
        }
    ]
    background_tasks.add_task(send_whatsapp_list_message, ai_instance, pasajero_phone, title, description, button_text, sections)
    
    return {"message": "Notificaciones enviadas", "sent": True}

@router.post("/viajes/{viaje_id}/notificar-llegada")
def notificar_llegada(viaje_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    # 1. Obtener datos del viaje
    v_resp = supabase.table("viajes").select("*").eq("id", viaje_id).execute()
    if not v_resp.data:
         raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    
    viaje = v_resp.data[0]
    pasajero_phone = viaje.get("origen", {}).get("cliente_telefono")
    ai_instance = viaje.get("origen", {}).get("ai_instance", "viajesnea")
    
    # 2. Actualizar estado a 'en_puerta'
    supabase.table("viajes").update({"estado": "en_puerta"}).eq("id", viaje_id).execute()
    
    if not pasajero_phone:
         return {"message": "Sin telefono de contacto", "sent": False}
    
    # 3. Notificar pasajero
    llegada_msg = "🚗 *¡Tu chofer ya está en la puerta esperándote!*"
    background_tasks.add_task(send_whatsapp_message, ai_instance, pasajero_phone, llegada_msg)
    
    return {"message": "Notificación de llegada enviada", "sent": True}

@router.post("/viajes/{viaje_id}/cancelar")
def cancelar_viaje(viaje_id: str, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    # 1. Obtener datos del viaje
    v_resp = supabase.table("viajes").select("*").eq("id", viaje_id).execute()
    if not v_resp.data:
         raise HTTPException(status_code=404, detail="Viaje no encontrado.")
    
    viaje = v_resp.data[0]
    pasajero_phone = viaje.get("origen", {}).get("cliente_telefono")
    ai_instance = viaje.get("origen", {}).get("ai_instance", "viajesnea")
    
    # 2. Actualizar estado a 'cancelado' y liberar al chofer (ya no está en curso)
    supabase.table("viajes").update({"estado": "cancelado"}).eq("id", viaje_id).execute()
    
    if pasajero_phone:
        # 3. Notificar pasajero y sugerir pedir otro
        cancel_msg = "⚠️ *Viaje Cancelado*\n\nEl chofer asignado tuvo un inconveniente y no podrá realizar tu viaje. Por favor, solicita un nuevo móvil enviando un mensaje al bot. ¡Disculpa las molestias!"
        background_tasks.add_task(send_whatsapp_message, ai_instance, pasajero_phone, cancel_msg)
    
    return {"message": "Viaje cancelado exitosamente", "sent": True}

@router.post("/sos")
def notificar_emergencia(lat: float, lng: float, background_tasks: BackgroundTasks, claims: Dict[str, Any] = Depends(get_current_chofer)):
    chofer_user_id = claims.get("sub")
    
    usr_resp = supabase.table("usuarios").select("nombre").eq("id", chofer_user_id).execute()
    chofer_nombre = usr_resp.data[0]["nombre"] if usr_resp.data else "Un Chofer Desconocido"
    
    chf_resp = supabase.table("choferes").select("vehiculo, patente").eq("usuario_id", chofer_user_id).execute()
    auto_info = ""
    if chf_resp.data:
        vehiculo = chf_resp.data[0].get("vehiculo", "Auto")
        patente = chf_resp.data[0].get("patente", "N/A")
        auto_info = f"en un *{vehiculo}* (Patente: *{patente}*)"
    
    if settings.EMERGENCY_PHONE:
        mensaje = f"🚨 *¡ALERTA SOS - BOTÓN DE PÁNICO!* 🚨\n\nEl chofer *{chofer_nombre}* {auto_info} ha activado la alerta de emergencia.\n\n📍 *Última ubicación GPS:*\nhttps://www.google.com/maps/search/?api=1&query={lat},{lng}\n\n⚠️ Revisar el Panel de Administración inmediatamente."
        # Se envía usando el webhook principal de 'viajesnea' al número maestro configurado
        background_tasks.add_task(send_whatsapp_message, "viajesnea", settings.EMERGENCY_PHONE, mensaje)
    
    return {"message": "Alerta SOS Procesada", "sent": True}
