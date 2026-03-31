-- PARCHE MULTI-TENANT: Corregir funciones RLS (Row Level Security)

-- El enfoque anterior requería custom JWT claims. Este nuevo script utiliza 
-- SECURITY DEFINER para buscar la organización de forma nativa sin romper la app.

-- 1. Eliminar políticas antiguas que dependían del JWT Claim
DROP POLICY IF EXISTS "usuarios_isolation" ON public.usuarios;
DROP POLICY IF EXISTS "choferes_isolation" ON public.choferes;
DROP POLICY IF EXISTS "viajes_isolation" ON public.viajes;
DROP POLICY IF EXISTS "promociones_isolation" ON public.promociones;

-- 2. Función segura para obtener la organización del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_current_organizacion_id() RETURNS UUID AS $$
  SELECT organizacion_id FROM public.usuarios WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Nueva Política: USUARIOS
-- Permite al usuario verse A SÍ MISMO para poder iniciar sesión, 
-- O permite ver a toda su organización si es parte de ella.
CREATE POLICY "usuarios_isolation" ON public.usuarios
    FOR ALL
    USING (
      id = auth.uid() OR 
      organizacion_id = public.get_current_organizacion_id()
    );

-- 4. Nueva Política: CHOFERES
CREATE POLICY "choferes_isolation" ON public.choferes
    FOR ALL
    USING (organizacion_id = public.get_current_organizacion_id());

-- 5. Nueva Política: VIAJES
CREATE POLICY "viajes_isolation" ON public.viajes
    FOR ALL
    USING (organizacion_id = public.get_current_organizacion_id());

-- 6. Nueva Política: PROMOCIONES
CREATE POLICY "promociones_isolation" ON public.promociones
    FOR ALL
    USING (organizacion_id = public.get_current_organizacion_id());
