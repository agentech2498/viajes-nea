from fastapi import APIRouter, HTTPException
from app.db.supabase import supabase

router = APIRouter()

@router.get("/viajes/{viaje_id}/tracking")
def get_viaje_tracking(viaje_id: str):
    """
    Endpoint público para visualizar el estado y datos del chofer asignado 
    a un viaje, usado para el Live Tracker. No requiere autenticación JWT.
    """
    
    v_resp = supabase.table("viajes").select("id, estado, origen, destino, chofer_id, precio, organizacion_id").eq("id", viaje_id).execute()
    
    if not v_resp.data:
         raise HTTPException(status_code=404, detail="Viaje no encontrado o link vencido.")
    
    viaje = v_resp.data[0]
    
    safe_viaje = {
        "id": viaje.get("id"),
        "estado": viaje.get("estado"),
        "origen": viaje.get("origen"),
        "destino": viaje.get("destino"),
        "precio": viaje.get("precio"),
        "organizacion_id": viaje.get("organizacion_id"),
        "chofer": None
    }
    
    if viaje.get("chofer_id"):
        ch_resp = supabase.table("choferes").select("vehiculo, patente, lat, lng, usuario_id").eq("id", viaje["chofer_id"]).execute()
        if ch_resp.data:
            chofer_data = ch_resp.data[0]
            
            usr_resp = supabase.table("usuarios").select("nombre").eq("id", chofer_data["usuario_id"]).execute()
            nombre = usr_resp.data[0]["nombre"] if usr_resp.data else "Chofer"
            
            safe_viaje["chofer"] = {
                "nombre": nombre,
                "vehiculo": chofer_data.get("vehiculo"),
                "patente": chofer_data.get("patente", ""),
                "usuario_id": chofer_data.get("usuario_id"),  
                "lat": chofer_data.get("lat"),
                "lng": chofer_data.get("lng")
            }
            
    return safe_viaje
