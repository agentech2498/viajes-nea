-- backend/fixed_destinations_update.sql

CREATE TABLE IF NOT EXISTS public.fixed_destinations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    details VARCHAR(100),
    peaje BOOLEAN DEFAULT FALSE,
    column_index INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.fixed_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Destinos fijos visibles para todos"
    ON public.fixed_destinations FOR SELECT
    USING (true);

CREATE POLICY "Destinos fijos editables por todos"
    ON public.fixed_destinations FOR ALL
    USING (true);

-- Limpiar tabla por si se ejecuta múltiples veces
TRUNCATE TABLE public.fixed_destinations;

-- Insertar valores por defecto Columna 1
INSERT INTO public.fixed_destinations (name, price, details, peaje, column_index) VALUES
('Barranqueras', 21250, '19 km', false, 1),
('Sombrero', 37800, '36 km', true, 1),
('Empedrado', 65100, '62 km', true, 1),
('Formosa', 194250, '185 km', true, 1),
('Hiper Libertad', 21000, '18 km', true, 1),
('Laguna Brava', 16000, '15 km', false, 1),
('Paso de la Patria', 42000, '40 km', false, 1),
('Resistencia', 21000, '20 km', true, 1),
('Res. Aeropuerto', 30450, '29 km', true, 1),
('Res. Terminal', 30450, '29 km', true, 1),
('Shopping Res.', 18000, '17 km', true, 1),
('Riachuelo', 22100, '21 km', false, 1),
('San Cosme', 37800, '36 km', false, 1),
('San Luis del Palmar', 31500, '30 km', false, 1),
('Santa Ana', 21000, '20 km', false, 1),
('Itati', 77700, '74 km', false, 1),
('Saladas', 111300, '106 km', true, 1),
('Ing. 1° Correntino', 29400, '28 km', false, 1);

-- Insertar valores por defecto Columna 2
INSERT INTO public.fixed_destinations (name, price, details, peaje, column_index) VALUES
('Puente Pexoa', 19000, '18 km', false, 2),
('Unidad 6', 19000, '18 km', false, 2),
('Cañada Quiroz', 17000, '16 km', false, 2),
('Ramada Paso', 57750, '55 km', false, 2),
('Barrio Pescadores', 6300, '6 km', false, 2),
('Bella Vista', 151200, '144 km', false, 2),
('Ituzaingo', 241500, '230 km', false, 2);
