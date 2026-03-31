import json
import random
import logging
from openai import AsyncOpenAI
from app.core.config import settings
from app.db.supabase import supabase
from app.core.evolution import send_whatsapp_message
from app.core.geocoding import geocode_address
from app.core.pricing import calculate_fare, generate_price_list

logger = logging.getLogger(__name__)

# Requerirá tener openai>=1.0.0 instalado (lo asumimos por ser FastAPI 2024+)
try:
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
except:
    client = None

# Tools definitions para GPT
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "confirmar_viaje_inmediato",
            "description": "Utiliza esta función ÚNICAMENTE cuando el pasajero te ha dicho explícitamente que SÍ acepta un viaje AHORA. Requiere tener: Origen, Destino y Precio.",
            "parameters": {
                "type": "object",
                "properties": {
                    "nombre": {"type": "string", "description": "Nombre del cliente"},
                    "origen": {"type": "string", "description": "Dirección completa de origen"},
                    "destino": {"type": "string", "description": "Dirección completa de destino"},
                    "precio": {"type": "number", "description": "Precio numérico pactado"}
                },
                "required": ["origen", "destino", "precio"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "consultar_precio_puntual",
            "description": "Calcula la tarifa exacta y distancia de un punto A a un punto B.",
            "parameters": {
                "type": "object",
                "properties": {
                    "origen": {"type": "string", "description": "Dirección de origen"},
                    "destino": {"type": "string", "description": "Dirección de destino"}
                },
                "required": ["origen", "destino"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "mostrar_tarifario",
            "description": "Muestra la tabla de precios generales de la remisería al usuario."
        }
    },
    {
        "type": "function",
        "function": {
            "name": "iniciar_reserva",
            "description": "El cliente desea agendar o reservar un viaje a futuro (no inmediato). Captura los datos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "nombre": {"type": "string"},
                    "origen": {"type": "string"},
                    "destino": {"type": "string"},
                    "fecha": {"type": "string", "description": "Fecha en formato YYYY-MM-DD"},
                    "hora": {"type": "string", "description": "Hora en formato HH:MM"}
                },
                "required": ["origen", "destino", "fecha", "hora"]
            }
        }
    }
]

SYSTEM_PROMPT = """Eres el operador virtual inteligente de la remisería "Viajes NEA".
Tu trabajo es atender por WhatsApp con tono amable, estilo correntino/chaqueño (cálido).
Nuevas capacidades:
1. Si el cliente pregunta precios generales o dice "tarifario/lista de precios", llama a `mostrar_tarifario`.
2. Si pregunta cuánto sale de un lugar a otro, llama a `consultar_precio_puntual` (solo asegúrate de tener A y B).
3. Si quiere viajar YA MISMO, pide origen y destino (si no tienes el precio, calcula con consultar_precio_puntual primero). Si confirma viajar YA, llama a `confirmar_viaje_inmediato`.
4. Si quiere RESERVAR para otro día u hora, pide fecha y hora concretas y llama a `iniciar_reserva`.
NUNCA inventes precios si tienes herramientas para calcularlos. Si la herramienta te devuelve el precio, confirmale al usuario antes de mandar auto o reservar."""

async def procesar_mensaje_whatsapp(instance: str, phone: str, message: str, push_name: str = ""):
    """Núcleo del Cerebro NLP."""
    
    if not client:
        return # Missing OpenAI keys
    
    # 1. Recuperar contexto de Supabase
    chat_req = supabase.table("chat_sessions").select("*").eq("telefono", phone).execute()
    
    historial = []
    if chat_req.data:
        historial = chat_req.data[0].get("historial", [])
    else:
        # Insert initial
        supabase.table("chat_sessions").insert({
            "telefono": phone,
            "historial": [],
            "estado": "negociando"
        }).execute()

    # Agregamos el mensaje del usuario al historial para enviarlo al bot
    historial.append({"role": "user", "content": message})
    
    # Preparar envío al LLM
    messages_payload = [{"role": "system", "content": SYSTEM_PROMPT}] + historial

    # 2. Llamada a la Inteligencia Artificial
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages_payload,  # type: ignore
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.7,
            max_tokens=250
        )
    except Exception as e:
        logger.error(f"Error OpenAI: {e}")
        await send_whatsapp_message(instance, phone, "Hubo un pequeño corte en nuestra central satelital 📡, ¿me lo repites por favor?")
        return

    ai_msg = response.choices[0].message

    if ai_msg.tool_calls:
        tool = ai_msg.tool_calls[0]
        org_res = supabase.table("organizaciones").select("id").limit(1).execute()
        org_id = org_res.data[0]["id"] if org_res.data else None

        if not org_id:
            await send_whatsapp_message(instance, phone, "Error interno: Organización no configurada.")
            return

        if tool.function.name == "mostrar_tarifario":
            listado = generate_price_list(org_id)
            # Agregar la respuesta del tool al historial
            historial.append({"role": "assistant", "content": None, "tool_calls": [tool.model_dump()]})
            historial.append({"role": "tool", "tool_call_id": tool.id, "content": listado})
            supabase.table("chat_sessions").update({"historial": historial}).eq("telefono", phone).execute()
            await send_whatsapp_message(instance, phone, listado + "\n\n¿Deseas consultar un tramo específico o pedir un móvil?")
            return

        if tool.function.name == "consultar_precio_puntual":
            args = json.loads(tool.function.arguments)
            origen = args.get("origen")
            destino = args.get("destino")
            
            orig_lat, orig_lng = await geocode_address(origen)
            dest_lat, dest_lng = await geocode_address(destino)
            
            # Cálculo de distancia simple euclidiana aproximada o harcoded a 2.5km si falla (idealmente usar Google Matrix)
            import math
            dist_km = math.sqrt((orig_lat - dest_lat)**2 + (orig_lng - dest_lng)**2) * 111.0
            if dist_km <= 0 or math.isnan(dist_km): dist_km = 2.5 # Fallback
                
            precio_calc = calculate_fare(dist_km, org_id)
            respuesta_tool = f"El costo estimado desde {origen} hasta {destino} ({dist_km:.1f} KM) es de ${precio_calc:.0f}."
            
            historial.append({"role": "assistant", "content": None, "tool_calls": [tool.model_dump()]})
            historial.append({"role": "tool", "tool_call_id": tool.id, "content": respuesta_tool})
            supabase.table("chat_sessions").update({"historial": historial}).eq("telefono", phone).execute()
            
            await send_whatsapp_message(instance, phone, respuesta_tool + " ¿Confirmás el viaje o quieres reservar para después?")
            return

        if tool.function.name == "iniciar_reserva":
            args = json.loads(tool.function.arguments)
            nombre = args.get("nombre", push_name or "Cliente")
            res_data = {
                "organizacion_id": org_id,
                "nombre_cliente": nombre,
                "telefono": phone,
                "origen": args.get("origen"),
                "destino": args.get("destino"),
                "fecha_viaje": args.get("fecha"),
                "hora_viaje": args.get("hora"),
                "estado": "confirmada"
            }
            supabase.table("reservations").insert(res_data).execute()
            respuesta = f"✅ ¡Reserva agendada con éxito, {nombre}!\nDesde: {args.get('origen')}\nHasta: {args.get('destino')}\nPara el: {args.get('fecha')} a las {args.get('hora')}hs.\nTe avisaremos cuando el móvil esté en camino ese día."
            
            supabase.table("chat_sessions").update({"historial": [], "estado": "reservado"}).eq("telefono", phone).execute()
            await send_whatsapp_message(instance, phone, respuesta)
            return

        if tool.function.name == "confirmar_viaje_inmediato":
            args = json.loads(tool.function.arguments)
            origen = args.get("origen")
            destino = args.get("destino")
            precio = args.get("precio")
            nombre = args.get("nombre", push_name or "Cliente")

            origen_lat, origen_lng = await geocode_address(origen)
            destino_lat, destino_lng = await geocode_address(destino)

            viaje_data = {
                "organizacion_id": org_id,
                "origen": {"direccion": origen, "lat": origen_lat, "lng": origen_lng, "cliente_telefono": phone, "ai_instance": instance},
                "destino": {"direccion": destino, "lat": destino_lat, "lng": destino_lng},
                "precio": precio,
                "estado": "solicitado"
            }
            supabase.table("viajes").insert(viaje_data).execute()
            
            respuesta_texto = f"✅ Perfecto {nombre}, he lanzado la bengala a nuestros choferes. Tu remis está siendo despachado para {origen}.\n💸 Cotización fijada: ${precio}.\nEn instantes te avisaremos quién va."
            supabase.table("chat_sessions").update({"historial": [], "estado": "confirmado"}).eq("telefono", phone).execute()
            await send_whatsapp_message(instance, phone, respuesta_texto)
            return

    # Si no ejecutó herramienta, simplemente devuelve la respuesta de GPT al usuario
    texto_gpt = ai_msg.content
    if texto_gpt:
        historial.append({"role": "assistant", "content": texto_gpt})
        
        # Mantener historial corto (Máx 15 msgs)
        if len(historial) > 15:
            historial = historial[-10:]

        supabase.table("chat_sessions").update({
            "historial": historial,
            "estado": "negociando"
        }).eq("telefono", phone).execute()
        
        # Enviar WhatsApp
        await send_whatsapp_message(instance, phone, texto_gpt)
