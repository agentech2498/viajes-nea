from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

class Organizacion(BaseModel):
    id: UUID
    nombre: str
    dominio: Optional[str] = None
    whatsapp_numero: Optional[str] = None
    plan: str
    activo: bool

    model_config = ConfigDict(from_attributes=True)

class Usuario(BaseModel):
    id: UUID
    organizacion_id: UUID
    email: str
    nombre: str
    telefono: Optional[str] = None
    rol: str
    activo: bool

    model_config = ConfigDict(from_attributes=True)

class Chofer(BaseModel):
    id: UUID
    organizacion_id: UUID
    usuario_id: UUID
    vehiculo: str
    patente: str
    dni: Optional[str] = None
    estado: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    tipo_pago: Optional[str] = "comision"
    valor_pago: Optional[float] = 0.0
    saldo: float = 0.0
    limite_deuda: float = -2000.0

    model_config = ConfigDict(from_attributes=True)

class Viaje(BaseModel):
    id: UUID
    organizacion_id: UUID
    cliente_id: Optional[UUID] = None
    chofer_id: Optional[UUID] = None
    origen: Dict[str, Any]
    destino: Dict[str, Any]
    estado: str
    precio: Optional[float] = None
    creado_en: datetime

    model_config = ConfigDict(from_attributes=True)

class Promocion(BaseModel):
    id: UUID
    organizacion_id: UUID
    titulo: str
    descripcion: Optional[str] = None
    puntos_requeridos: int = 0

    model_config = ConfigDict(from_attributes=True)
