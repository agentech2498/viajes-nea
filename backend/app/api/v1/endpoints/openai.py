from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from app.core.security import get_current_user
from openai import OpenAI
from app.core.config import settings

router = APIRouter()
client = OpenAI(api_key=settings.OPENAI_API_KEY)

@router.post("/chat")
def process_message(user_message: str, claims: Dict[str, Any] = Depends(get_current_user)):
    """
    Toma un mensaje del cliente o usuario y utiliza ChatGPT Mini para procesarlo
    y automatizar intenciones (Por ej. "quiero un remis hasta el centro").
    """
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Eres el asistente inteligente de una remisería. Tu objetivo es interpretar la solicitud del cliente y extraer origen y destino."},
                {"role": "user", "content": user_message}
            ]
        )
        return {"response": completion.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
