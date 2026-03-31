import math
import logging
from app.db.supabase import supabase

logger = logging.getLogger(__name__)

def calculate_fare(distance_km: float, org_id: str) -> float:
    """
    Calcula la tarifa dinámica usando la configuración de la base de datos.
    Fórmula: base_fare + (fracciones * per_fraction_price)
    """
    try:
        # Obtenemos la tarifa activa para la organización
        resp = supabase.table("tariff_configs").select("*").eq("organizacion_id", org_id).eq("is_active", True).execute()
        
        if not resp.data:
            logger.warning(f"No hay tarifa activa para organización {org_id}. Fallback a 0.")
            return 0.0

        t = resp.data[0]
        base_fare = float(t["base_fare"])
        fraction_km = float(t["fraction_km"])
        fraction_price = float(t["per_fraction_price"])

        # Si el viaje es menor o igual a 1 km (bajada de bandera)
        if distance_km <= 1.0:
            return round(base_fare, 2)

        # Distancia adicional después del primer kilómetro
        extra_km = distance_km - 1.0
        
        # Redondeamos siempre hacia arriba la cantidad de fracciones gastadas
        fractions_count = math.ceil(extra_km / fraction_km)
        
        total = base_fare + (fractions_count * fraction_price)
        
        # Redondear el total (ej. a múltiplo de 10 o directamente al entero más cercano)
        return round(total, 2)
        
    except Exception as e:
        logger.error(f"Error calculando tarifa: {e}")
        return 0.0

def generate_price_list(org_id: str, max_km: int = 5) -> str:
    """
    Genera un listado de precios formateado en texto para devolver por WhatsApp.
    Muestra ejemplos desde 1.0 km hasta max_km.
    """
    try:
        resp = supabase.table("tariff_configs").select("*").eq("organizacion_id", org_id).eq("is_active", True).execute()
        
        if not resp.data:
            return "No hay un tarifario activo configurado en este momento."

        t = resp.data[0]
        
        lines = [
            "📋 *TARIFARIO ACTUAL*",
            "-----------------------",
            f"🚗 Bajada de Bandera (1 KM): *${float(t['base_fare']):.0f}*",
            f"📏 Cada {float(t['fraction_km']):.1f} KM adicional: *${float(t['per_fraction_price']):.0f}*",
            "-----------------------",
            "Ejemplos de viaje:"
        ]
        
        # Generar ejemplos cada 0.5 km o 1 km
        current_km = 1.0
        while current_km <= max_km:
            precio = calculate_fare(current_km, org_id)
            lines.append(f"📍 {current_km:.1f} KM ➝ *${precio:.0f}*")
            current_km += 1.0
            
        return "\n".join(lines)
        
    except Exception as e:
        logger.error(f"Error generando listado de tarifas: {e}")
        return "Hubo un error al generar el tarifario actual."
