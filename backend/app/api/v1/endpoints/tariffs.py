from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.security import get_current_admin
from app.db.supabase import supabase

router = APIRouter()

class TariffConfigCreate(BaseModel):
    base_fare: float
    per_fraction_price: float
    fraction_km: float

class TariffConfigResponse(BaseModel):
    id: str
    base_fare: float
    per_fraction_price: float
    fraction_km: float
    is_active: bool

class FixedDestinationCreate(BaseModel):
    name: str
    price: float
    details: Optional[str] = None
    peaje: bool = False
    column_index: int = 1

class FixedDestinationResponse(FixedDestinationCreate):
    id: str
    created_at: Optional[datetime] = None

@router.get("/", response_model=List[TariffConfigResponse])
def get_tariffs(claims: Dict[str, Any] = Depends(get_current_admin)):
    """Obtiene el historial de tarifas (activa e inactivas) de la organización."""
    org_id = claims.get("organizacion_id")
    resp = supabase.table("tariff_configs").select("*").eq("organizacion_id", org_id).order("created_at", desc=True).execute()
    return resp.data

@router.get("/active", response_model=Optional[TariffConfigResponse])
def get_active_tariff(claims: Dict[str, Any] = Depends(get_current_admin)):
    """Obtiene SOLO la tarifa activa actual."""
    org_id = claims.get("organizacion_id")
    resp = supabase.table("tariff_configs").select("*").eq("organizacion_id", org_id).eq("is_active", True).execute()
    if not resp.data:
        return None
    return resp.data[0]

@router.post("/", response_model=TariffConfigResponse)
def create_tariff(data: TariffConfigCreate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Crea una nueva tarifa y la establece como la ÚNICA activa."""
    org_id = claims.get("organizacion_id")
    user_id = claims.get("sub") # ID del admin que hace el cambio

    # 1. Obtener la activa actual para guardarla en historial
    current = supabase.table("tariff_configs").select("*").eq("organizacion_id", org_id).eq("is_active", True).execute()
    
    # 2. Desactivar la actual
    if current.data:
        old_id = current.data[0]["id"]
        supabase.table("tariff_configs").update({"is_active": False}).eq("id", old_id).execute()
        
        # Guardar historial
        supabase.table("tariff_history").insert({
            "organizacion_id": org_id,
            "tariff_id": old_id,
            "old_base_fare": current.data[0]["base_fare"],
            "old_fraction_price": current.data[0]["per_fraction_price"],
            "changed_by": user_id
        }).execute()

    # 3. Insertar la nueva tarifa
    new_tariff = {
        "organizacion_id": org_id,
        "base_fare": data.base_fare,
        "per_fraction_price": data.per_fraction_price,
        "fraction_km": data.fraction_km,
        "is_active": True
    }
    
    insert_resp = supabase.table("tariff_configs").insert(new_tariff).execute()
    return insert_resp.data[0]

@router.get("/destinations", response_model=List[FixedDestinationResponse])
def get_destinations(claims: Dict[str, Any] = Depends(get_current_admin)):
    """Obtiene los destinos fijos ordenados por columna y nombre."""
    resp = supabase.table("fixed_destinations").select("*").order("column_index").order("name").execute()
    return resp.data

@router.post("/destinations", response_model=FixedDestinationResponse)
def create_destination(data: FixedDestinationCreate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Crea un nuevo destino fijo."""
    resp = supabase.table("fixed_destinations").insert(data.dict()).execute()
    return resp.data[0]

@router.delete("/destinations/{dest_id}")
def delete_destination(dest_id: str, claims: Dict[str, Any] = Depends(get_current_admin)):
    """Elimina un destino fijo por su ID."""
    supabase.table("fixed_destinations").delete().eq("id", dest_id).execute()
    return {"status": "ok", "deleted": dest_id}
