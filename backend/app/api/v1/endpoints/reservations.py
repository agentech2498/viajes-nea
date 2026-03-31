from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import date, time

from app.core.security import get_current_admin
from app.db.supabase import supabase

router = APIRouter()

class ReservationCreate(BaseModel):
    nombre_cliente: str
    telefono: str
    origen: str
    destino: str
    fecha_viaje: date
    hora_viaje: time
    distancia_km: float = 0.0
    costo_estimado: float = 0.0
    estado: str = "pendiente"

class ReservationUpdate(BaseModel):
    estado: str # Ej: 'asignada', 'completada', 'cancelada'

@router.get("/")
def get_reservations(estado: Optional[str] = None, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Obtiene las reservas de la organización, opcionalmente filtradas por estado."""
    org_id = claims.get("organizacion_id")
    query = supabase.table("reservations").select("*").eq("organizacion_id", org_id)
    if estado:
        query = query.eq("estado", estado)
    
    resp = query.order("fecha_viaje", desc=False).order("hora_viaje", desc=False).execute()
    return resp.data

@router.post("/")
def create_reservation(data: ReservationCreate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Permite a un admin crear una reserva manual."""
    org_id = claims.get("organizacion_id")
    
    nuevo = data.dict()
    # Pydantic serializa date/time como objetos, convertir a str ISO para Supabase
    nuevo["fecha_viaje"] = data.fecha_viaje.isoformat()
    nuevo["hora_viaje"] = data.hora_viaje.isoformat()
    nuevo["organizacion_id"] = org_id
    
    resp = supabase.table("reservations").insert(nuevo).execute()
    return resp.data[0]

@router.put("/{res_id}/estado")
def update_reservation_status(res_id: str, data: ReservationUpdate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Cambia el estado de una reserva (Ej: Pasa a asignada o cancelada)."""
    org_id = claims.get("organizacion_id")
    
    # Validar existencia
    check = supabase.table("reservations").select("id").eq("id", res_id).eq("organizacion_id", org_id).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
        
    resp = supabase.table("reservations").update({"estado": data.estado}).eq("id", res_id).execute()
    return resp.data[0]
