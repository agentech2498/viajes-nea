from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
import secrets
import string

from app.core.security import get_current_admin
from app.db.supabase import supabase
from app.schemas.domain import Chofer, Promocion
from pydantic import BaseModel, EmailStr

router = APIRouter()

class ChoferCreate(BaseModel):
    nombre: str
    email: EmailStr
    telefono: str
    vehiculo: str
    patente: str
    dni: str
    tipo_pago: str = "comision" # 'base' o 'comision'
    valor_pago: float = 0.0

class ChoferResponse(BaseModel):
    id: str
    nombre: str
    email: str
    password_temporal: str

@router.post("/chofer", response_model=ChoferResponse)
def create_chofer(data: ChoferCreate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """
    Carga de un nuevo Chofer por parte del Administrador.
    Genera clave automática y asocia los perfiles correspondientes.
    """
    org_id = claims.get("organizacion_id")
    
    # 1. Generar Contraseña Aleatoria Compleja
    alphabet = string.ascii_letters + string.digits
    password = "Nea" + ''.join(secrets.choice(alphabet) for i in range(6)) + "!"

    # 2. Crear Auth User en Supabase (Requiere Service Role configurado en .env)
    try:
        auth_res = supabase.auth.admin.create_user({
            "email": data.email,
            "password": password,
            "email_confirm": True
        })
        user_id = auth_res.user.id
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo crear en Auth: {str(e)}")

    # 3. Insertar Perfil Usuario (como Chofer)
    try:
        user_insert = supabase.table("usuarios").insert({
            "id": user_id,
            "organizacion_id": org_id,
            "email": data.email,
            "nombre": data.nombre,
            "telefono": data.telefono,
            "rol": "chofer"
        }).execute()
        
        # 4. Insertar Perfil Chofer (Vehículo y Pago)
        chofer_insert = supabase.table("choferes").insert({
            "organizacion_id": org_id,
            "usuario_id": user_id,
            "vehiculo": data.vehiculo,
            "patente": data.patente,
            "dni": data.dni,
            "estado": "inactivo",
            "tipo_pago": data.tipo_pago,
            "valor_pago": data.valor_pago
        }).execute()
        
        return ChoferResponse(
            id=chofer_insert.data[0]["id"],
            nombre=data.nombre,
            email=data.email,
            password_temporal=password
        )

    except Exception as e:
        # Mecanismo de Rollback básico del Auth user para no dejar basura si falla SQL
        try:
             supabase.auth.admin.delete_user(user_id)
        except:
             pass
        raise HTTPException(status_code=500, detail=f"Falla insertando roles: {str(e)}")


@router.get("/choferes")
def get_choferes(claims: Dict[str, Any] = Depends(get_current_admin)):
    """
    Obtener todos los choferes con detalles de usuario (nombre, email, etc.)
    """
    org_id = claims.get("organizacion_id")
    response = supabase.table("choferes") \
        .select("*, usuarios(nombre, email, telefono)") \
        .eq("organizacion_id", org_id) \
        .execute()
    return response.data

class ChoferUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    telefono: Optional[str] = None
    vehiculo: Optional[str] = None
    patente: Optional[str] = None
    dni: Optional[str] = None
    tipo_pago: Optional[str] = None
    valor_pago: Optional[float] = None
    activo: Optional[bool] = None

@router.put("/chofer/{chofer_id}")
def update_chofer(chofer_id: str, data: ChoferUpdate, claims: Dict[str, Any] = Depends(get_current_admin)):
    """
    Actualizar datos de un chofer y su perfil de usuario asociado.
    """
    org_id = claims.get("organizacion_id")
    
    # 1. Verificar existencia y pertenencia
    c_check = supabase.table("choferes").select("id, usuario_id").eq("id", chofer_id).eq("organizacion_id", org_id).single().execute()
    if not c_check.data:
        raise HTTPException(status_code=404, detail="Chofer no encontrado o no pertenece a su organización")
    
    u_id = c_check.data["usuario_id"]

    # 2. Actualizar Tabla Usuarios
    u_update = {}
    if data.nombre: u_update["nombre"] = data.nombre
    if data.email: u_update["email"] = data.email
    if data.telefono: u_update["telefono"] = data.telefono
    if data.activo is not None: u_update["activo"] = data.activo
    
    if u_update:
        supabase.table("usuarios").update(u_update).eq("id", u_id).execute()
        # Si cambia el email, actualizar en Auth también
        if data.email:
            try:
                supabase.auth.admin.update_user_by_id(u_id, {"email": data.email})
            except:
                pass

    # 3. Actualizar Tabla Choferes
    c_update = {}
    if data.vehiculo: c_update["vehiculo"] = data.vehiculo
    if data.patente: c_update["patente"] = data.patente
    if data.dni: c_update["dni"] = data.dni
    if data.tipo_pago: c_update["tipo_pago"] = data.tipo_pago
    if data.valor_pago is not None: c_update["valor_pago"] = data.valor_pago
    
    if c_update:
        supabase.table("choferes").update(c_update).eq("id", chofer_id).execute()

    return {"message": "Chofer actualizado correctamente"}

@router.delete("/chofer/{chofer_id}")
def delete_chofer(chofer_id: str, claims: Dict[str, Any] = Depends(get_current_admin)):
    """
    Eliminar un chofer de forma definitiva (DDBB + Auth).
    """
    org_id = claims.get("organizacion_id")
    
    # 1. Obtener usuario_id antes de borrar
    c_data = supabase.table("choferes").select("id, usuario_id").eq("id", chofer_id).eq("organizacion_id", org_id).single().execute()
    if not c_data.data:
        raise HTTPException(status_code=404, detail="Chofer no encontrado")
        
    u_id = c_data.data["usuario_id"]

    # 2. Borrar Chofer (La tabla tiene FK a usuarios cascade? si no, borrar manual)
    supabase.table("choferes").delete().eq("id", chofer_id).execute()
    
    # 3. Borrar Perfil Usuario
    supabase.table("usuarios").delete().eq("id", u_id).execute()
    
    # 4. Borrar de Auth (Para evitar que siga logueado o use recursos)
    try:
        supabase.auth.admin.delete_user(u_id)
    except:
        pass

    return {"message": "Chofer y usuario eliminados correctamente"}

@router.post("/promociones", response_model=Promocion)
def create_promocion(promo_data: dict, claims: Dict[str, Any] = Depends(get_current_admin)):
    org_id = claims.get("organizacion_id")
    promo_data["organizacion_id"] = org_id
    response = supabase.table("promociones").insert(promo_data).execute()
    return response.data[0]

class PagoRequest(BaseModel):
    monto: float
    tipo: str
    descripcion: Optional[str] = ""

@router.post("/chofer/{chofer_id}/pago")
def registrar_pago(chofer_id: str, data: PagoRequest, claims: Dict[str, Any] = Depends(get_current_admin)):
    org_id = claims.get("organizacion_id")
    
    # 1. Obtener Chofer
    c_resp = supabase.table("choferes").select("*").eq("id", chofer_id).execute()
    if not c_resp.data:
        raise HTTPException(status_code=404, detail="Chofer no encontrado")
    
    chofer = c_resp.data[0]
    nuevo_saldo = float(chofer.get("saldo", 0)) + data.monto
    
    # 2. Registrar el historial de pago
    supabase.table("pagos_choferes").insert({
        "organizacion_id": org_id,
        "chofer_id": chofer_id,
        "monto": data.monto,
        "tipo": data.tipo,
        "descripcion": data.descripcion
    }).execute()
    
    # 3. Actualizar saldo del chofer
    u_resp = supabase.table("choferes").update({"saldo": nuevo_saldo}).eq("id", chofer_id).execute()
    
    return {"message": "Pago registrado con éxito", "nuevo_saldo": nuevo_saldo}
