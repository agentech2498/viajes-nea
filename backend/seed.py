import sys
import os
import asyncio
from app.db.supabase import supabase

def seed_database():
    print("--- INICIANDO SEED DE BASE DE DATOS ---")
    
    # 1. Crear Organización "El Rayo"
    print("Creando Organización 'El Rayo'...")
    org_res = supabase.table("organizaciones").insert({
        "nombre": "El Rayo",
        "dominio": "elrayo.app",
        "plan": "pro"
    }).execute()
    
    # Manejar caso de que ya exista y no use unique constraint (inserción directa)
    org_id = org_res.data[0]["id"]
    print("Organización Creada. ID:", org_id)

    # 2. Crear User Admin Auth
    # NOTA: Supabase requires email and password to create users via Admin SDK if using service_role key
    print("Creando Usuario Administrador (admin@viajesnea.app)...")
    email = "admin@viajesnea.app"
    password = "AdminPassword123!"
    
    try:
        auth_response = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True
        })
        user_id = auth_response.user.id
        print(f"Usuario Creado en Auth. ID: {user_id}")
    except Exception as e:
        print(f"Falló alta de admin en auth: {e}")
        return

    # 3. Vincular Usuario Admin en tabla `usuarios` (Asociando `organizacion_id` y rol 'admin')
    print("Enlazando usuario al Rol Administrador...")
    user_res = supabase.table("usuarios").insert({
        "id": user_id,
        "organizacion_id": org_id,
        "email": email,
        "nombre": "Administrador General",
        "rol": "admin"
    }).execute()

    print("--- SEED EXITOSO ---")
    print(f"Organizacion ID: {org_id}")
    print(f"Login Admin: {email}")
    print(f"Password: {password}")

if __name__ == "__main__":
    seed_database()
