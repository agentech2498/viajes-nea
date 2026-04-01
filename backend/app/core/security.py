from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Dict, Any

from app.core.config import settings

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verifica el token JWT de Supabase y extrae los claims correspondientes
    a user_id y organizacion_id, así como el rol.
    """
    token = credentials.credentials
    try:
        # Verificación segura de JWT comprobando la firma (Fundamental para Producción)
        if settings.SUPABASE_JWT_SECRET:
            claims = jwt.decode(
                token, 
                key=settings.SUPABASE_JWT_SECRET, 
                algorithms=["HS256"], 
                audience="authenticated"
            )
        else:
            # FALLBACK INSEGURO PARA EVITAR ROMPER EL SISTEMA (Advertencia severa)
            import logging
            logging.getLogger(__name__).warning("CRÍTICO: SUPABASE_JWT_SECRET no configurado. Permitiendo bypass de validación JWT.")
            claims = jwt.decode(token, options={"verify_signature": False})
            
        # Validamos que haya un user sub
        if "sub" not in claims:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
            
        return claims

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

from app.db.supabase import supabase

def get_current_user(claims: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token no contiene sub")
    
    # Obtener rol y organización desde la base de datos
    res = supabase.table("usuarios").select("rol, organizacion_id").eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=401, detail="Usuario no registrado en la plataforma")
    
    # Combinamos los claims originales con los datos recien traídos (rol y originacion_id)
    return {**claims, **res.data[0]}

def get_current_admin(claims: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    rol = claims.get("rol", "")
    if rol not in ["admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No authorized as admin")
    return claims

def get_current_chofer(claims: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    rol = claims.get("rol", "")
    if rol not in ["chofer", "admin", "superadmin"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No authorized as chofer")
    return claims
