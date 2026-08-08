-- =====================================================================
-- Presentismo Medintt — esquema multi-tenant (Supabase / Postgres)
-- =====================================================================
-- Correr este archivo completo en el SQL Editor de Supabase (una sola vez).
-- Diseñado para que cada empresa cliente ("organización") tenga sus datos
-- completamente aislados de las demás mediante Row Level Security (RLS).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type rol_usuario as enum ('admin', 'supervisor_sede', 'empleado');
create type tipo_marcacion as enum ('ingreso', 'egreso');
create type resultado_validacion as enum ('dentro_de_zona', 'fuera_de_zona');

-- ---------------------------------------------------------------------
-- Organizaciones (empresas cliente que contratan el servicio)
-- ---------------------------------------------------------------------
create table organizaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo_url text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Perfiles de usuario (1 a 1 con auth.users de Supabase)
-- ---------------------------------------------------------------------
create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  nombre_completo text not null,
  rol rol_usuario not null default 'empleado',
  activo boolean not null default true,
  consentimiento_aceptado_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_perfiles_organizacion on perfiles(organizacion_id);

-- ---------------------------------------------------------------------
-- Sedes / geofences (predio propio o sedes de clientes que se visitan)
-- ---------------------------------------------------------------------
create table sedes (
  id uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  nombre text not null,
  latitud double precision not null,
  longitud double precision not null,
  radio_metros integer not null default 400,
  supervisor_id uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_sedes_organizacion on sedes(organizacion_id);

-- ---------------------------------------------------------------------
-- Asignación empleado ↔ sede, con el horario en que esa sede es válida
-- Un empleado puede tener varias sedes asignadas (ej. sede propia +
-- sedes de clientes que visita), cada una con su propio horario.
-- ---------------------------------------------------------------------
create table empleado_sedes (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references perfiles(id) on delete cascade,
  sede_id uuid not null references sedes(id) on delete cascade,
  dias_semana smallint[] not null default '{1,2,3,4,5}', -- 1=lunes ... 7=domingo
  hora_inicio time not null,
  hora_fin time not null,
  created_at timestamptz not null default now(),
  unique (empleado_id, sede_id)
);

create index idx_empleado_sedes_empleado on empleado_sedes(empleado_id);
create index idx_empleado_sedes_sede on empleado_sedes(sede_id);

-- ---------------------------------------------------------------------
-- Marcaciones: registro inmutable de cada ingreso/egreso.
-- Solo se permite INSERT y SELECT (nunca UPDATE/DELETE) vía RLS.
-- No se guarda un log continuo de posiciones, solo el punto de marcado.
-- ---------------------------------------------------------------------
create table marcaciones (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references perfiles(id) on delete cascade,
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  tipo tipo_marcacion not null,
  timestamp_marcacion timestamptz not null default now(),
  latitud double precision not null,
  longitud double precision not null,
  precision_metros double precision,
  sede_id uuid references sedes(id) on delete set null,
  distancia_metros double precision,
  resultado resultado_validacion not null,
  tarde boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_marcaciones_empleado on marcaciones(empleado_id, timestamp_marcacion desc);
create index idx_marcaciones_organizacion on marcaciones(organizacion_id, timestamp_marcacion desc);

-- ---------------------------------------------------------------------
-- Funciones auxiliares (security definer) para evitar recursión de RLS
-- ---------------------------------------------------------------------
create or replace function auth_organizacion_id()
returns uuid
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select organizacion_id from perfiles where id = auth.uid();
$$;

create or replace function auth_rol()
returns rol_usuario
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select rol from perfiles where id = auth.uid();
$$;

-- Marca el consentimiento informado como aceptado por el propio usuario.
-- Función acotada (en vez de una policy de UPDATE abierta) para que el
-- empleado no pueda modificar su rol, organización u otros campos.
create or replace function aceptar_consentimiento()
returns void
language sql security definer
set search_path = public
as $$
  update perfiles set consentimiento_aceptado_at = now() where id = auth.uid();
$$;

grant execute on function aceptar_consentimiento() to authenticated;

-- ---------------------------------------------------------------------
-- RLS: organizaciones
-- ---------------------------------------------------------------------
alter table organizaciones enable row level security;

create policy "ver mi organizacion" on organizaciones
  for select using (id = auth_organizacion_id());

-- ---------------------------------------------------------------------
-- RLS: perfiles
-- ---------------------------------------------------------------------
alter table perfiles enable row level security;

create policy "ver mi propio perfil" on perfiles
  for select using (id = auth.uid());

-- No hay policies de "admin ve todo el equipo" / "supervisor ve su sede" acá
-- a propósito: evaluar auth_rol()/auth_organizacion_id() (que leen de
-- perfiles) DENTRO de una policy sobre la propia tabla perfiles dispara
-- "infinite recursion detected in policy for relation perfiles" en Postgres,
-- incluso siendo funciones SECURITY DEFINER. Esa visibilidad ampliada se
-- resuelve en el código de la app con el cliente admin (service role),
-- siempre después de validar el rol del que pide los datos
-- (ver app/presentismo/admin/empleados y app/presentismo/admin).
--
-- Nota: alta/edición de usuarios también se hace server-side con la service
-- role key, no hay policy de insert/update para clientes.

-- ---------------------------------------------------------------------
-- RLS: sedes
-- ---------------------------------------------------------------------
alter table sedes enable row level security;

create policy "ver sedes de mi organizacion" on sedes
  for select using (organizacion_id = auth_organizacion_id());

create policy "admin administra sedes de su organizacion" on sedes
  for all using (auth_rol() = 'admin' and organizacion_id = auth_organizacion_id())
  with check (auth_rol() = 'admin' and organizacion_id = auth_organizacion_id());

-- ---------------------------------------------------------------------
-- RLS: empleado_sedes
-- ---------------------------------------------------------------------
alter table empleado_sedes enable row level security;

create policy "empleado ve sus propias asignaciones" on empleado_sedes
  for select using (empleado_id = auth.uid());

create policy "supervisor ve asignaciones de sus sedes" on empleado_sedes
  for select using (
    auth_rol() = 'supervisor_sede' and exists (
      select 1 from sedes s where s.id = empleado_sedes.sede_id and s.supervisor_id = auth.uid()
    )
  );

create policy "admin administra asignaciones de su organizacion" on empleado_sedes
  for all using (
    auth_rol() = 'admin' and exists (
      select 1 from perfiles p where p.id = empleado_sedes.empleado_id and p.organizacion_id = auth_organizacion_id()
    )
  )
  with check (
    auth_rol() = 'admin' and exists (
      select 1 from perfiles p where p.id = empleado_sedes.empleado_id and p.organizacion_id = auth_organizacion_id()
    )
  );

-- ---------------------------------------------------------------------
-- RLS: marcaciones (inmutables: sin policies de update/delete)
-- ---------------------------------------------------------------------
alter table marcaciones enable row level security;

create policy "empleado ve sus propias marcaciones" on marcaciones
  for select using (empleado_id = auth.uid());

create policy "empleado inserta sus propias marcaciones" on marcaciones
  for insert with check (empleado_id = auth.uid() and organizacion_id = auth_organizacion_id());

create policy "admin ve marcaciones de su organizacion" on marcaciones
  for select using (auth_rol() = 'admin' and organizacion_id = auth_organizacion_id());

create policy "supervisor ve marcaciones de empleados de sus sedes" on marcaciones
  for select using (
    auth_rol() = 'supervisor_sede' and exists (
      select 1 from sedes s where s.id = marcaciones.sede_id and s.supervisor_id = auth.uid()
    )
  );
