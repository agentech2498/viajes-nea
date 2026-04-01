from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import base64
from typing import Dict, Any, Union

from app.core.config import settings

security = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verifica el token JWT de Supabase y extrae los claims correspondientes
    """
    token = credentials.credentials
    try:
        if settings.SUPABASE_JWT_SECRET:
            # Supabase suele dar el secreto en Base64. 
            # Es vital decodificarlo a bytes antes de usarlo como clave simétrica para HS256.
            secret = settings.SUPABASE_JWT_SECRET.strip()
            
            try:
                # Intentamos decodificarlo. Si no es base64, b64decode levantará un error.
                # Añadimos padding extra si hiciera falta (seguridad ante cortes accidentales)
                # padding = '=' * (4 - len(secret) % 4)
                key: Union[bytes, str] = base64.b64decode(secret)
            except Exception:
                # Si no era base64, lo usamos directamente como string
                key = secret
            
            claims = jwt.decode(
                token, 
                key=key, 
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
    except jwt.InvalidAlgorithmError:
        raise HTTPException(status_code=401, detail="Error de configuración de seguridad (Algoritmo no permitido).")
    except Exception as e:
        # Log para depuración silenciosa (no exponer en el detail si es posible, pero aquí lo dejamos para arreglar el error del usuario)
        print(f"Error JWT: {str(e)}")
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
