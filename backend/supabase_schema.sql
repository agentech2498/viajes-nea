-- === VIAJES-NEA: ESQUEMA DE BASE DE DATOS MULTI-TENANT ===
-- Asegurando aislamiento de datos por "organizacion_id" mediante RLS

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLAS FRONTALES
CREATE TABLE IF NOT EXISTS public.organizaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    dominio TEXT,
    whatsapp_numero TEXT,
    plan TEXT DEFAULT 'free',
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT,
    rol TEXT CHECK (rol IN ('admin', 'chofer', 'cliente', 'superadmin')) DEFAULT 'cliente',
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.choferes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    vehiculo TEXT NOT NULL,
    patente TEXT NOT NULL,
    estado TEXT CHECK (estado IN ('disponible', 'ocupado', 'inactivo')) DEFAULT 'inactivo',
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.viajes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    chofer_id UUID REFERENCES public.choferes(id) ON DELETE SET NULL,
    origen JSONB NOT NULL,    -- Ej: {"direccion": "...", "lat": ..., "lng": ...}
    destino JSONB NOT NULL,
    estado TEXT CHECK (estado IN ('solicitado', 'asignado', 'en_camino', 'finalizado', 'cancelado')) DEFAULT 'solicitado',
    precio NUMERIC(10, 2),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.promociones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    puntos_requeridos INTEGER DEFAULT 0,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. HABILITACIÓN DE RLS (ROW LEVEL SECURITY)
ALTER TABLE public.organizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.choferes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promociones ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICAS DE AISLAMIENTO MULTI-TENANT (Excepto SuperAdmin)

-- Función útil para obtener la organización actual del Auth Context (JWT claim)
CREATE OR REPLACE FUNCTION public.get_auth_orga_id() RETURNS UUID AS $$
BEGIN
  RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'organizacion_id')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_auth_rol() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::jsonb ->> 'rol';
END;
$$ LANGUAGE plpgsql STABLE;

-- Políticas para USUARIOS
CREATE POLICY "usuarios_isolation" ON public.usuarios
    FOR ALL
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

-- Políticas para CHOFERES
CREATE POLICY "choferes_isolation" ON public.choferes
    FOR ALL
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

-- Políticas para VIAJES
CREATE POLICY "viajes_isolation" ON public.viajes
    FOR ALL
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');

-- Políticas para PROMOCIONES
CREATE POLICY "promociones_isolation" ON public.promociones
    FOR ALL
    USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');
