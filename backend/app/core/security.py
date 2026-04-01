from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Dict, Any

from app.core.config import settings

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verifica el token JWT de Supabase usando HMAC-SHA256 (HS256).
    El JWT_SECRET de Supabase es un string plano — NO se decodifica en base64.
    """
    token = credentials.credentials
    try:
        if settings.SUPABASE_JWT_SECRET:
            # Limpiar comillas y espacios accidentales (fix del commit anterior)
            secret: str = settings.SUPABASE_JWT_SECRET.strip().strip('"').strip("'")

            # Supabase siempre firma con HS256. Usar SÓLO ese algoritmo
            # evita el "alg not allowed" de PyJWT cuando el tipo de clave
            # no coincide con el algoritmo declarado en la lista.
            claims = jwt.decode(
                token,
                key=secret,
                algorithms=["HS256"],
                audience="authenticated"
            )
        else:
            import logging
            logging.getLogger(__name__).warning("CRÍTICO: SUPABASE_JWT_SECRET no configurado.")
            claims = jwt.decode(token, options={"verify_signature": False})

        if "sub" not in claims:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token claims")

        return claims

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada. Por favor, inicie sesión de nuevo.")
    except jwt.InvalidAlgorithmError as e:
        raise HTTPException(status_code=401, detail=f"Error de algoritmo: {str(e)}. Verifique su SUPABASE_JWT_SECRET.")
    except jwt.DecodeError as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")
    except Exception as e:
        print(f"Error JWT Crítico: {str(e)}")
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
