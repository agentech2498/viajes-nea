import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

async def send_whatsapp_message(instance_name: str, phone_number: str, message: str):
    """
    Envia un texto plano via Evolution API a un usuario final.
    """
    if "@s.whatsapp.net" not in phone_number:
        # Evolution generalmente acepta 5493794123456 sin el postfix, pero a veces sí lo requiere
        pass
        
    url = f"{settings.EVOLUTION_URL}/message/sendText/{instance_name}"
    headers = {
        "apikey": settings.EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "number": phone_number,
        "text": message
    }
    
    async with httpx.AsyncClient() as client:
        try:
             res = await client.post(url, headers=headers, json=payload, timeout=5.0)
             if res.status_code >= 400:
                 logger.error(f"Error Evolution API: {res.text}")
        except Exception as e:
             logger.error(f"Error enviando WPP: {e}")

async def send_whatsapp_list_message(instance_name: str, phone_number: str, title: str, description: str, button_text: str, sections: list):
    """
    Envia un mensaje interactivo de tipo Lista (List Message) a través de Evolution API.
    Apto para pedir calificación con 1 a 5 estrellas.
    """
    url = f"{settings.EVOLUTION_URL}/message/sendList/{instance_name}"
    headers = {
        "apikey": settings.EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "number": phone_number,
        "title": title,
        "description": description,
        "buttonText": button_text,
        "sections": sections
    }
    
    async with httpx.AsyncClient() as client:
        try:
             res = await client.post(url, headers=headers, json=payload, timeout=5.0)
             if res.status_code >= 400:
                 logger.error(f"Error Evolution API SendList: {res.text}")
        except Exception as e:
             logger.error(f"Error enviando WPP List: {e}")
