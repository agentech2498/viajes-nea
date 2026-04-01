from fastapi import APIRouter, Request, BackgroundTasks
import logging
from app.core.bot import procesar_mensaje_whatsapp, procesar_audio_y_responder

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/evolution")
async def evolution_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Ruta que Evolution API atacará cuando llegue un WhatsApp.
    Ejemplo Payload:
    {
      "event": "messages.upsert",
      "instance": "MiRemiseria123",
      "data": {
        "message": {
          "conversation": "Mándame un remís desde la terminal"
        },
        "key": {
          "remoteJid": "5491100000000@s.whatsapp.net",
          "fromMe": false
        },
        "pushName": "Juan"
      }
    }
    """
    try:
        from app.core.config import settings
        # Validar el Webhook Secret (Si está configurado en .env)
        if settings.WEBHOOK_SECRET:
            # Soportar que el secreto venga por Header (x-webhook-secret) o por URL (?secret=Miclave)
            header_secret = request.headers.get("x-webhook-secret")
            query_secret = request.query_params.get("secret")
            
            # Chequeamos si alguno de los dos lados tiene la clave correcta
            if (not header_secret or header_secret != settings.WEBHOOK_SECRET) and (not query_secret or query_secret != settings.WEBHOOK_SECRET):
                logger.warning("Fallo de autenticación en Webhook: Secreto inválido omitido")
                return {"status": "unauthorized"}

        body = await request.json()
        logger.info(f"Webhook recibido: {body}")
        
        event = body.get("event")
        # Solo procesamos si hay mensaje nuevo
        if event != "messages.upsert":
            return {"status": "ok"}
            
        data = body.get("data", {})
        instance = body.get("instance", "default")
        
        # Extracción segura de properties
        key = data.get("key", {})
        is_me = key.get("fromMe", True)
        remote_jid = key.get("remoteJid", "")
        
        if is_me or "@g.us" in remote_jid:
            # Ignorar mensajes míos o de grupos
            return {"status": "ignored"}
            
        # Extraer texto (puede venir como 'conversation' o 'extendedTextMessage')
        msg_obj = data.get("message", {})
        
        # --- NUEVO LÓGICA: INTERCEPCIÓN DE RESPUESTAS A LISTAS (CALIFICACIONES) ---
        # Detectar respuesta de lista ("listResponseMessage" en schema Baileys/Evolution)
        list_response = msg_obj.get("listResponseMessage", {})
        row_id = None
        
        if list_response:
             # Formato Baileys standard
             row_id = list_response.get("singleSelectReply", {}).get("selectedRowId")
        elif "listResponse" in msg_obj:
             # Formato simplificado (ejemplo aportado)
             row_id = msg_obj["listResponse"].get("rowId")
        
        if row_id and row_id.startswith("rate_"):
             # Extraemos la calificación y procesamos
             # Formato: "rate_5_viaje123"
             partes = row_id.split("_")
             if len(partes) >= 3:
                 puntaje = int(partes[1])
                 id_viaje = "_".join(partes[2:])
                 
                 from app.db.supabase import supabase
                 # Guardar calificación en DB y enviar mensaje de agradecimiento
                 supabase.table("viajes").update({"calificacion": puntaje}).eq("id", id_viaje).execute()
                 logger.info(f"Viaje {id_viaje} calificado con {puntaje} estrellas")
                 
                 # Enviamos un msj simple de agradecimiento sin pasar por el bot
                 from app.core.evolution import send_whatsapp_message
                 remote_jid = key.get("remoteJid", "")
                 phone_number = remote_jid.split("@")[0]
                 background_tasks.add_task(send_whatsapp_message, instance, phone_number, f"¡Gracias por tu calificación de {puntaje} estrellas! Trabajamos para brindarte el mejor servicio.")
                 return {"status": "rating_processed"}
                 
        # --- FIN LÓGICA DE LISTAS ---

        texto_recibido = ""
        es_audio = False
        
        if "conversation" in msg_obj:
            texto_recibido = msg_obj["conversation"]
        elif "extendedTextMessage" in msg_obj:
            texto_recibido = msg_obj["extendedTextMessage"].get("text", "")
        elif "audioMessage" in msg_obj:
            es_audio = True
            
        push_name = data.get("pushName", "")
        phone_number = remote_jid.split("@")[0]
            
        if es_audio:
            # Lo pasamos a background para transcribir y luego mandar al NLP
            background_tasks.add_task(
                procesar_audio_y_responder,
                instance=instance,
                phone=phone_number,
                msg_obj={"message": data}, # Pasa el objeto `data` completo (incluye 'key') requerido por Evolution API para Base64
                push_name=push_name
            )
            return {"status": "processing_audio"}
            
        if not texto_recibido:
             return {"status": "no_text"}

        # Lo pasamos a background para no bloquear a Evolution API (Timeout de respo rápido)
        background_tasks.add_task(
            procesar_mensaje_whatsapp,
            instance=instance,
            phone=phone_number,
            message=texto_recibido,
            push_name=push_name
        )
        
        return {"status": "processing"}

    except Exception as e:
        logger.error(f"Error procesando el webhook: {e}")
        return {"status": "error"}
