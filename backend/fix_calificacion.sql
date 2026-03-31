ALTER TABLE public.viajes
ADD COLUMN calificacion SMALLINT NULL CHECK (calificacion >= 1 AND calificacion <= 5);
