-- FASE 3: Motor de Inteligencia Artificial para WhatsApp (Evolution -> OpenAI)

-- Creamos la tabla de sesiones de chat para que el Bot de OpenAI "recuerde" de qué está hablando
-- con cada cliente por WhatsApp hasta que se concrete el viaje.

CREATE TABLE IF NOT EXISTS public.chat_sessions (
    telefono TEXT PRIMARY KEY,
    historial JSONB DEFAULT '[]'::jsonb,
    estado TEXT DEFAULT 'negociando', -- negociando, confirmado
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar seguridad mínima si fuese necesario, pero normalmente el backend accede via service_role
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Política para que el admin/backend pueda operar libremente
CREATE POLICY "service_role_chat_sessions" ON public.chat_sessions
    FOR ALL
    USING (true);
