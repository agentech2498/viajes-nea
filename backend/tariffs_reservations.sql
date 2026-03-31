-- === EXTENSIÓN: TARIFAS Y RESERVAS ===

-- 1. Tabla: Configuraciones de Tarifas
CREATE TABLE IF NOT EXISTS public.tariff_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    base_fare NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    per_fraction_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    fraction_km NUMERIC(5, 2) NOT NULL DEFAULT 0.10,
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Constraint para asegurar solo 1 tarifa activa por organización (Unique parcial)
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_tariff 
ON public.tariff_configs(organizacion_id) 
WHERE is_active = true;

-- 2. Tabla: Historial de Tarifas (Auditoría)
CREATE TABLE IF NOT EXISTS public.tariff_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    tariff_id UUID NOT NULL REFERENCES public.tariff_configs(id) ON DELETE CASCADE,
    old_base_fare NUMERIC(10, 2),
    old_fraction_price NUMERIC(10, 2),
    changed_by UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabla: Branding Visual (Opcional, pero se añade por completitud)
CREATE TABLE IF NOT EXISTS public.tariff_branding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE UNIQUE,
    company_name TEXT NOT NULL,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#000000',
    secondary_color TEXT DEFAULT '#ffffff'
);

-- 4. Tabla: Reservas Independientes
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizacion_id UUID NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
    nombre_cliente TEXT NOT NULL,
    telefono TEXT NOT NULL,
    origen TEXT NOT NULL,
    destino TEXT NOT NULL,
    fecha_viaje DATE NOT NULL,
    hora_viaje TIME NOT NULL,
    distancia_km NUMERIC(10, 2),
    costo_estimado NUMERIC(10, 2),
    estado TEXT CHECK (estado IN ('pendiente', 'confirmada', 'asignada', 'completada', 'cancelada')) DEFAULT 'pendiente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabla: Estado Conversacional (Opcional/Futuro)
CREATE TABLE IF NOT EXISTS public.conversation_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telefono TEXT NOT NULL UNIQUE,
    estado_actual TEXT DEFAULT 'init',
    datos_parciales JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HABILITACIÓN RLS
ALTER TABLE public.tariff_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariff_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_state ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS AISLAMIENTO
CREATE POLICY "tariffs_isolation" ON public.tariff_configs FOR ALL USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');
CREATE POLICY "history_isolation" ON public.tariff_history FOR ALL USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');
CREATE POLICY "branding_isolation" ON public.tariff_branding FOR ALL USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');
CREATE POLICY "reservas_isolation" ON public.reservations FOR ALL USING (organizacion_id = public.get_auth_orga_id() OR public.get_auth_rol() = 'superadmin');
-- conversation_state no requiere aislamiento estricto por organización si el bot identifica org por session context, pero si aplica:
-- CREATE POLICY "conv_state_isolation" ON public.conversation_state FOR ALL USING (true); -- Al ser pública/bot
