-- 1. Eliminar la restricción actual de estado en la tabla viajes
ALTER TABLE public.viajes DROP CONSTRAINT IF EXISTS viajes_estado_check;

-- 2. Volver a crearla con los nuevos estados: 'en_puerta'
ALTER TABLE public.viajes ADD CONSTRAINT viajes_estado_check CHECK (estado IN ('solicitado', 'asignado', 'en_camino', 'en_puerta', 'finalizado', 'cancelado'));
