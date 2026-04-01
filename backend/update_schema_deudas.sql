-- backend/update_schema_deudas.sql

-- 1. Añadimos campo de fecha de inicio de deuda a choferes si no existe
ALTER TABLE public.choferes ADD COLUMN IF NOT EXISTS fecha_inicio_deuda TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.choferes ADD COLUMN IF NOT EXISTS estado VARCHAR(50) DEFAULT 'activo'; -- Asegurando que tengan estado

-- 2. Creamos la función del Trigger
CREATE OR REPLACE FUNCTION public.actualizar_fecha_deuda_chofer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si el saldo baja a valor negativo y antes era >= 0 (o nulo)
  IF (NEW.saldo < 0) AND (OLD.saldo IS NULL OR OLD.saldo >= 0) THEN
    NEW.fecha_inicio_deuda := timezone('utc'::text, now());
  END IF;

  -- Si el saldo vuelve a ser >= 0, limpiamos la fecha e intentamos activar si estaba bloqueado por deuda
  IF (NEW.saldo >= 0) THEN
    NEW.fecha_inicio_deuda := NULL;
    -- Opcional: Desbloquear automáticamente si paga
    IF (OLD.estado = 'inactivo' OR OLD.estado = 'bloqueado') THEN
      NEW.estado := 'activo';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Asignamos el Trigger a la tabla choferes
DROP TRIGGER IF EXISTS trg_actualizar_fecha_deuda ON public.choferes;

CREATE TRIGGER trg_actualizar_fecha_deuda
BEFORE UPDATE ON public.choferes
FOR EACH ROW
WHEN (OLD.saldo IS DISTINCT FROM NEW.saldo)
EXECUTE FUNCTION public.actualizar_fecha_deuda_chofer();

-- 4. Actualizamos a los que ya tienen deuda para que empiecen a contar desde hoy o una fecha anterior simulada
UPDATE public.choferes 
SET fecha_inicio_deuda = timezone('utc'::text, now()) - INTERVAL '10 days' -- Para que el cron los agarre de inmediato en pruebas, o lo ajustas
WHERE saldo < 0 AND fecha_inicio_deuda IS NULL;
