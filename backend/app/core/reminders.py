import logging
import pytz
from datetime import datetime, timedelta
from app.db.supabase import supabase
from app.core.evolution import send_whatsapp_message

logger = logging.getLogger(__name__)

# Configuración del mensaje
CBU_ALIAS = "abaco.dado.plus.mp"

async def procesar_y_enviar_recordatorios():
    """
    Función programada para evaluar las deudas de los choferes y enviar recordatorios
    con bloqueo automático tras 10 días de morosidad.
    """
    logger.info("Iniciando rutina de control de deudas automáticas...")
    
    # 1. Calcular la fecha límite (Hace 10 días desde hoy a esta hora)
    # Por seguridad, tomamos la fecha de hace 10 días.
    fecha_limite = datetime.utcnow() - timedelta(days=10)
    fecha_limite_iso = fecha_limite.isoformat()

    # 2. Consultar a los choferes cuya deuda superó los 10 días y que todavía están activos.
    # supabase: WHERE saldo < 0 AND fecha_inicio_deuda <= fecha_limite AND estado != 'inactivo'
    try:
        res = supabase.table("choferes").select(
            "id, nombre, telefono, saldo, ai_instance"
        ).lt("saldo", 0).lte("fecha_inicio_deuda", fecha_limite_iso).neq("estado", "inactivo").execute()
    except Exception as e:
        logger.error(f"Error consultando choferes morosos: {e}")
        return

    choferes_morosos = res.data
    logger.info(f"Se encontraron {len(choferes_morosos)} choferes que superaron los 10 días de deuda activa.")

    if not choferes_morosos:
        return

    # 3. Recorrer la lista, bloquearlos y enviarles el recordatorio amigable pero firme
    choferes_ids = [c["id"] for c in choferes_morosos]
    
    # Bloqueamos (inactivamos) a todos en batch si es posible, o individualmente
    if choferes_ids:
        try:
            # Actualización Batch
            # OJO: Supabase in(.in_("id", list)) is format. In postgrest it's `.in_`
            supabase.table("choferes").update({"estado": "inactivo"}).in_("id", choferes_ids).execute()
            logger.info(f"Choferes suspendidos exitosamente: {choferes_ids}")
        except Exception as e:
            logger.error(f"Error actualizando estado de choferes a inactivo: {e}")

    # 4. Enviar el WhatsApp (Iteramos sobre cada uno para personalizar y mandar por su respectiva instancia)
    for chofer in choferes_morosos:
        nombre = chofer.get("nombre", "Chofer").split(" ")[0]
        telefono = chofer.get("telefono", "")
        saldo_deuda = abs(chofer.get("saldo", 0))
        instancia_ai = chofer.get("ai_instance", "default")
        
        mensaje = (
            f"👋 ¡Hola {nombre}! Esperamos que estés teniendo un excelente día.\n\n"
            f"Nos contactamos desde la administración de *Viajes NEA* para avisarte que, "
            f"al revisar tu billetera, notamos que tenés un saldo negativo de *${saldo_deuda:,.2f}* "
            f"que ya supera los 10 días de antigüedad. 📆💳\n\n"
            f"⚠️ *Importante:* Temporalmente hemos pausado el despacho de nuevos viajes a tu cuenta hasta que se regularice la situación.\n\n"
            f"🙏 Te pedimos por favor que abones el saldo transferiendo a nuestra cuenta a la brevedad:\n"
            f"👉 *{CBU_ALIAS}*\n\n"
            f"Una vez realizado el pago, envianos el comprobante por este medio así volvemos a habilitarte tu perfil para que sigas trabajando con normalidad. ¡Muchas gracias por entender! 🚗💨"
        )
        
        if telefono:
            try:
                # Mandar MSJ por WhatsApp
                await send_whatsapp_message(instancia_ai, telefono, mensaje)
                logger.info(f"Recordatorio de deuda enviado a {nombre} ({telefono})")
            except Exception as e:
                logger.error(f"Error enviando notificación de deuda a {telefono}: {e}")
