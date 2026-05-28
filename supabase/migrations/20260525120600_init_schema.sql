-- Supabase Migration: 20260525120600_init_schema.sql
-- Description: Core system schema for Efficient Administrative Core (AdminCore)

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    cpf TEXT,
    avatar_url TEXT,
    password TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LEADERS TABLE
CREATE TABLE IF NOT EXISTS public.leaders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    cpf TEXT,
    avatar_url TEXT,
    registration_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
    password TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS public.registrations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    leader_id TEXT REFERENCES public.leaders(id) ON DELETE SET NULL,
    leader_name TEXT,
    date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- For storing arbitrary dynamic form inputs in a JSONB block
    dynamic_data JSONB DEFAULT '{}'::jsonb
);

-- 4. FORM FIELDS TABLE
CREATE TABLE IF NOT EXISTS public.form_fields (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    placeholder TEXT,
    required BOOLEAN DEFAULT FALSE,
    options TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

-- Create Open Security Policies for standard administration flow
CREATE POLICY "Allow all operations for public profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for public leaders" ON public.leaders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for public registrations" ON public.registrations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for public form fields" ON public.form_fields FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- SEED DATA (INITIAL DATA TO COLD START SUPABASE)
-- ==========================================

-- Seed Profiles
INSERT INTO public.profiles (id, name, email, phone, cpf, avatar_url, password)
VALUES (
    'p1', 
    'Ana Carolina Oliveira', 
    'ana.carolina@lideranca.com', 
    '(11) 98765-4321', 
    '123.456.789-00', 
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBh_aA6HorE7nq35g0h5HXyxEyRTqTXGmZ_Fsa7YgdsDoTadgIgarBa2XgaNN4iE0ZnTJpMNsX9v84nqtlr4nbv1hz9zheo6r8WC3Y6YDE_BTbsETZaAEzbnye9ERN0Z7w_jcpm1U5yurwwTXKc7pD53N5G7c_hTB_E5JUzFob_2W1pcigxjQ3V-NKuo8lx-jG3vYgSltp4x9ZLAhmbxnC68qi0Uq3GnGWRn6np0601sm-oChjpvTzNC9mXmSF9BgtPj4jtQGSR-Wp1',
    'admin123'
) ON CONFLICT (id) DO NOTHING;

-- Seed Leaders
INSERT INTO public.leaders (id, name, email, phone, cpf, avatar_url, registration_count, status, password)
VALUES 
('l1', 'Maria Souza', 'maria.souza@lideranca.com', '(11) 97123-4567', '234.567.890-11', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBylZWPul313G6ogEHZVPI4xWpYK7YX7sMKoQ-ARyVtPA-z2bKcu_13Z3ClToOclVyDnn8VySsuCiP94luQALeb82usYQP6Q0MqXrg4juL94JSRK1_EwwaZpWa7bHvAqeJ5GLc5eArbwfxowgyFi3UK2Fe9HGNDSNfOHxHWiDOYCbzMRyp88sD8WvRBNYuamCkYmi50U8xZLHWYSQLqwq2kIheOBnN8KSn7XMRH8aul0bx37NS9axTvRS22dd8OX5nHSBF49oCiHEbU', 156, 'Ativo', 'lider123'),
('l2', 'Carlos Alberto Silva', 'carlos.silva@lider.com', '(11) 98223-4455', '345.678.901-22', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBqSqcWc2kJo5-jPOAsbeGIb73aG0i_QnKy9b-NmRm3CWjLDJj4hYwyMD3D8hoylJyWJr2TNTScNu6gweCSmnYvCLbCAlhNTQ2BMZE5YnNxIzMvoAZ2P0JNm0DXeAEmRBgegNC_W7C-vKE26uOQpcfSt52h0K4UZnWBTXokjMEBuZyJq8qoHxpEzIjbC78LKdoM5eTOIK9y-kzr0kb3cKL5aD46C_lP1tU9KHX7Uv7ixekHZh-ZryJEIwsri-E3rBGiMVgf5oCpXZOc', 1420, 'Ativo', 'lider123'),
('l3', 'João Silva', 'joao.silva@lideranca.com', '(11) 96554-3321', '456.789.012-33', 'https://lh3.googleusercontent.com/aida-public/AB6AXuB0grgNMf3J0ooC9vRLefYi8OML2RW1ZZ2uwSMCkWzuWtEXkHDigjW2hJL9YcqzZ-Hmh90Jhia8Y5WzZMtSSVrKZl5YCGWPaj6ti5B7RinDuwrNQAha91qZmz8dkuz77WzNi2yvVoQtT-EY6NtBzJI-Y9DFrHJMGGXuyby52eT3Rd0f9j6GXRimZLFjpaYidGQfum2ac7rzGRkgxntQQ6EoQknjUreMXq27Cm8KbjztesL-qMheY9hBmNlOXbwvDVXVM7-7nRtytf6p', 185, 'Ativo', 'lider123'),
('l4', 'Mariana Costa', 'mariana.costa@email.com', '(21) 98888-7766', '567.890.123-44', 'https://lh3.googleusercontent.com/aida-public/AB6AXuAMyPG6Hb93_qFMDR8kndm5P-WgaH8z7F_IYwaz29qgZAQcJo6WQAVfUqM-NsnPfGBUgxsCGuXX-eouP9cwh3p0XwyVUqAtsuMb4r_AI6r3yvsVXykVmqacZBhvY3YAU0xZDgx-bjcnBpZq6rOgMRZxfq5KpiZzagei053-x4fs8SLyOfikJ7vDh5B7LpBIGg6xLTbyZ28aQFHyVJ66luyiP_KdOUtPyjyeZVjiwqy6fifAq_mMema4NR8gwjarNJ2nEPGFCLRR36uq', 982, 'Ativo', 'lider123'),
('l5', 'Lucas Lima', 'lucas.lima@lider.com', '(11) 97766-1122', '678.890.123-55', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCdOGifY_bL7FQNCFWcqIXsWB_yvsB7aH1kO7bGsKOq7acEAMmPIItRIUf68VYibnbYvOd-ibyE3-UnIjEYaryD5axIm16wFHQ2gdBrz6FRgkndT4j4P-Qor45m5CYAWwl23uJpxnBeP-c3AV1BLltEJw20QNmDgfghcCa5_N_hx00yL9PTawhVdUEMZrGKwpDaMHMHN4MMwD_dmM5h_QUN6TTYobqTZw7lGj4U6JNgRjAASwxI07o0xa75d8OY8w7z3WxW5s1xhnV7', 112, 'Ativo', 'lider123'),
('l6', 'Fernanda Dias', 'fernanda.dias@liderança.com', '(11) 96554-1100', '789.901.234-66', 'https://lh3.googleusercontent.com/aida-public/AB6AXuBlQT9LGeFUpuxB2yR3O2dfhz7zL_eSrrf2llLaenfKeBzx3c3J3zYM973XoPvQV_SP3gWHw8zVOPTeWrmUE53uGYtm3w7Bs8A4QPAjJXev9HcHLy4OcaHMuqRDkjkwpZhSK12jQHcLvih0Rn-izp-bUb2-XYNf3G_PUb5OG-zo2-2fRfPwlnRJxwzAcOOumFNfjh2-jaA6YfdyZtQQFX-3m4T_jHZLa0yzVhHjtH78ussE05tquWUYfJaU-Jp04y7c0W_RikwEsD9U', 98, 'Ativo', 'lider123'),
('l7', 'Roberto Mendes', 'roberto.mendes@gestao.com', '(11) 97722-0099', '890.012.345-77', 'https://lh3.googleusercontent.com/aida-public/AB6AXuCdOGifY_bL7FQNCFWcqIXsWB_yvsB7aH1kO7bGsKOq7acEAMmPIItRIUf68VYibnbYvOd-ibyE3-UnIjEYaryD5axIm16wFHQ2gdBrz6FRgkndT4j4P-Qor45m5CYAWwl23uJpxnBeP-c3AV1BLltEJw20QNmDgfghcCa5_N_hx00yL9PTawhVdUEMZrGKwpDaMHMHN4MMwD_dmM5h_QUN6TTYobqTZw7lGj4U6JNgRjAASwxI07o0xa75d8OY8w7z3WxW5s1xhnV7', 45, 'Inativo', 'lider123'),
('l8', 'Fernanda Lima', 'fernanda.lima@parceiro.com', '(19) 99345-6677', '901.123.456-88', 'https://lh3.googleusercontent.com/aida-public/AB6AXuAMyPG6Hb93_qFMDR8kndm5P-WgaH8z7F_IYwaz29qgZAQcJo6WQAVfUqM-NsnPfGBUgxsCGuXX-eouP9cwh3p0XwyVUqAtsuMb4r_AI6r3yvsVXykVmqacZBhvY3YAU0xZDgx-bjcnBpZq6rOgMRZxfq5KpiZzagei053-x4fs8SLyOfikJ7vDh5B7LpBIGg6xLTbyZ28aQFHyVJ66luyiP_KdOUtPyjyeZVjiwqy6fifAq_mMema4NR8gwjarNJ2nEPGFCLRR36uq', 2890, 'Ativo', 'lider123')
ON CONFLICT (id) DO NOTHING;

-- Seed Registrations
INSERT INTO public.registrations (id, name, category, leader_id, leader_name, date, created_at, dynamic_data)
VALUES
('r1', 'Rodrigo Almeida Santos', 'Alcoólicos Anônimos (AA)', 'l2', 'Carlos Alberto Silva', '10:45', '2026-05-21T10:45:00Z', '{}'::jsonb),
('r2', 'Juliana Pereira Costa', 'Autistas', 'l1', 'Maria Souza', '09:12', '2026-05-21T09:12:00Z', '{}'::jsonb),
('r3', 'Carlos Eduardo Lima', 'Alcoólicos Anônimos (AA)', 'l2', 'Carlos Alberto Silva', 'Ontem', '2026-05-20T16:30:00Z', '{}'::jsonb),
('r4', 'Roberto de Almeida', 'Dependentes Químicos', 'l1', 'Maria Souza', '24/05/2026', '2026-05-24T14:30:00Z', '{}'::jsonb),
('r5', 'Camila Ferraro', 'Autistas', 'l3', 'João Silva', '24/05/2026', '2026-05-24T11:15:00Z', '{}'::jsonb),
('r6', 'Marcos Vinícius', 'Alcoólicos Anônimos (AA)', 'l5', 'Lucas Lima', '23/05/2026', '2026-05-23T16:45:00Z', '{}'::jsonb),
('r7', 'Beatriz Silveira', 'Autistas', 'l6', 'Fernanda Dias', '22/05/2026', '2026-05-22T09:20:00Z', '{}'::jsonb),
('r8', 'Juliana Mendes', 'Empreendedores', 'l1', 'Maria Souza', '21/05/2026', '2026-05-21T10:15:00Z', '{}'::jsonb),
('r9', 'Roberto Souza', 'Estudantes', 'l2', 'Carlos Alberto Silva', '20/05/2026', '2026-05-20T16:45:00Z', '{}'::jsonb),
('r10', 'Fernanda Lima', 'Saúde', 'l2', 'Carlos Alberto Silva', '19/05/2026', '2026-05-19T09:20:00Z', '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed Form Fields
INSERT INTO public.form_fields (id, type, label, placeholder, required, options)
VALUES
('f1', 'text', 'Nome Completo', 'Digite o nome...', true, NULL),
('f2', 'cpf', 'Documento (CPF)', '000.000.000-00', true, NULL),
('f3', 'email', 'E-mail de Contato', 'exemplo@email.com', false, NULL),
('f4', 'select', 'Região / Setor', NULL, false, ARRAY['Regional Norte', 'Regional Sul', 'Regional Leste', 'Regional Oeste'])
ON CONFLICT (id) DO NOTHING;

-- 5. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Dynamic Policies for Categories
CREATE POLICY "Allow all operations for public categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

-- Seed Initial Categories
INSERT INTO public.categories (id, name)
VALUES
('c1', 'Alcoólicos Anônimos (AA)'),
('c2', 'Dependentes Químicos'),
('c3', 'Autistas'),
('c4', 'Empreendedores'),
('c5', 'Estudantes'),
('c6', 'Saúde'),
('c7', 'Outros')
ON CONFLICT (id) DO NOTHING;

