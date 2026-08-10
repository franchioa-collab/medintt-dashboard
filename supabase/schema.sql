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
-- 'super_admin' es el dueño de la plataforma (Medintt): da de alta empresas
-- clientes nuevas. 'admin' administra una sola empresa cliente puntual.
create type rol_usuario as enum ('super_admin', 'admin', 'supervisor_sede', 'empleado');
create type tipo_marcacion as enum ('ingreso', 'egreso');
-- 'sin_geocerca' es para marcaciones de empleados en trabajo de campo (sede
-- flotante, Etapa 3): no se compara contra ninguna sede fija.
create type resultado_validacion as enum ('dentro_de_zona', 'fuera_de_zona', 'sin_geocerca');

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
  -- Consentimiento específico para trabajo en campo (Etapa 3): se pide
  -- aparte porque implica registrar el recorrido del día, más sensible que
  -- el esquema "dentro/fuera de zona" del consentimiento general.
  consentimiento_flotante_aceptado_at timestamptz,
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
  -- Trabajo en campo (Etapa 3): la sede queda como referencia (dirección
  -- "base"), pero no se usa como geocerca — ni al marcar ni en los chequeos
  -- periódicos, que en cambio guardan siempre el punto para armar el
  -- recorrido del día.
  es_flotante boolean not null default false,
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
-- Suscripciones push (una fila por dispositivo/navegador del empleado)
-- ---------------------------------------------------------------------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references perfiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index idx_push_subscriptions_empleado on push_subscriptions(empleado_id);

-- ---------------------------------------------------------------------
-- Chequeos de ubicación periódicos durante la jornada (Etapa 2).
-- Se crea uno por aviso push enviado; el empleado lo responde al tocar la
-- notificación. Para empleados con sede fija, las coordenadas SOLO se
-- guardan si quedó fuera de zona — si confirma dentro de zona, o no
-- responde a tiempo, nunca se guarda ninguna ubicación, solo el resultado.
-- Para empleados en trabajo de campo (es_flotante, Etapa 3) el punto se
-- guarda siempre, para armar el recorrido del día.
-- ---------------------------------------------------------------------
create type estado_chequeo as enum ('pendiente', 'confirmado_dentro', 'confirmado_fuera', 'confirmado_campo', 'vencido');

create table chequeos_ubicacion (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references perfiles(id) on delete cascade,
  organizacion_id uuid not null references organizaciones(id) on delete cascade,
  sede_id uuid references sedes(id) on delete set null,
  enviado_en timestamptz not null default now(),
  vence_en timestamptz not null,
  respondido_en timestamptz,
  estado estado_chequeo not null default 'pendiente',
  latitud double precision,
  longitud double precision,
  distancia_metros double precision,
  -- Copiado de empleado_sedes.es_flotante al crear el chequeo, para que
  -- responder_chequeo() no necesite un join extra para decidir cómo
  -- procesar la respuesta.
  es_flotante boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_chequeos_empleado on chequeos_ubicacion(empleado_id, enviado_en desc);
create index idx_chequeos_organizacion on chequeos_ubicacion(organizacion_id, enviado_en desc);
create index idx_chequeos_pendientes on chequeos_ubicacion(estado, vence_en) where estado = 'pendiente';

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

-- Igual que aceptar_consentimiento(), pero para el consentimiento
-- específico de trabajo en campo (Etapa 3): se pide aparte porque implica
-- registrar el recorrido del día, no solo un resultado dentro/fuera.
create or replace function aceptar_consentimiento_campo()
returns void
language sql security definer
set search_path = public
as $$
  update perfiles set consentimiento_flotante_aceptado_at = now() where id = auth.uid();
$$;

grant execute on function aceptar_consentimiento_campo() to authenticated;

-- Responde un chequeo de ubicación periódico (Etapa 2): calcula la
-- distancia server-side (no confía en nada que mande el cliente más que
-- las coordenadas crudas) y decide el resultado. Solo guarda latitud y
-- longitud si el empleado quedó fuera de zona; si está dentro, o el
-- chequeo no le pertenece o ya fue respondido, no graba ubicación.
-- Para chequeos de trabajo en campo (es_flotante) no hay geocerca contra la
-- que comparar: el punto se guarda siempre, para el recorrido del día.
create or replace function responder_chequeo(chequeo_id uuid, lat double precision, lon double precision)
returns chequeos_ubicacion
language plpgsql security definer
set search_path = public
as $$
declare
  fila chequeos_ubicacion;
  sede_lat double precision;
  sede_lon double precision;
  sede_radio integer;
  dist double precision;
begin
  select * into fila from chequeos_ubicacion
    where id = chequeo_id and empleado_id = auth.uid() and estado = 'pendiente';

  if not found then
    raise exception 'chequeo_no_encontrado';
  end if;

  if fila.es_flotante then
    update chequeos_ubicacion
      set estado = 'confirmado_campo', respondido_en = now(), latitud = lat, longitud = lon
      where id = chequeo_id
      returning * into fila;
    return fila;
  end if;

  select latitud, longitud, radio_metros into sede_lat, sede_lon, sede_radio
    from sedes where id = fila.sede_id;

  if sede_lat is null then
    raise exception 'sede_no_encontrada';
  end if;

  dist := 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat - sede_lat) / 2), 2) +
    cos(radians(sede_lat)) * cos(radians(lat)) * power(sin(radians(lon - sede_lon) / 2), 2)
  ));

  if dist <= sede_radio then
    update chequeos_ubicacion
      set estado = 'confirmado_dentro', respondido_en = now(), distancia_metros = dist
      where id = chequeo_id
      returning * into fila;
  else
    update chequeos_ubicacion
      set estado = 'confirmado_fuera', respondido_en = now(), distancia_metros = dist,
          latitud = lat, longitud = lon
      where id = chequeo_id
      returning * into fila;
  end if;

  return fila;
end;
$$;

grant execute on function responder_chequeo(uuid, double precision, double precision) to authenticated;

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
  for all using (auth_rol() in ('admin', 'super_admin') and organizacion_id = auth_organizacion_id())
  with check (auth_rol() in ('admin', 'super_admin') and organizacion_id = auth_organizacion_id());

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
    auth_rol() in ('admin', 'super_admin') and exists (
      select 1 from perfiles p where p.id = empleado_sedes.empleado_id and p.organizacion_id = auth_organizacion_id()
    )
  )
  with check (
    auth_rol() in ('admin', 'super_admin') and exists (
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
  for select using (auth_rol() in ('admin', 'super_admin') and organizacion_id = auth_organizacion_id());

create policy "supervisor ve marcaciones de empleados de sus sedes" on marcaciones
  for select using (
    auth_rol() = 'supervisor_sede' and exists (
      select 1 from sedes s where s.id = marcaciones.sede_id and s.supervisor_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- RLS: push_subscriptions
-- ---------------------------------------------------------------------
alter table push_subscriptions enable row level security;

create policy "empleado administra sus propias suscripciones push" on push_subscriptions
  for all using (empleado_id = auth.uid())
  with check (empleado_id = auth.uid());

-- ---------------------------------------------------------------------
-- RLS: chequeos_ubicacion (inmutables desde el cliente salvo por la
-- función responder_chequeo(); no hay policy de insert/update para
-- clientes — los crea el cron con la service role key).
-- ---------------------------------------------------------------------
alter table chequeos_ubicacion enable row level security;

create policy "empleado ve sus propios chequeos" on chequeos_ubicacion
  for select using (empleado_id = auth.uid());

create policy "admin ve chequeos de su organizacion" on chequeos_ubicacion
  for select using (auth_rol() in ('admin', 'super_admin') and organizacion_id = auth_organizacion_id());

create policy "supervisor ve chequeos de empleados de sus sedes" on chequeos_ubicacion
  for select using (
    auth_rol() = 'supervisor_sede' and exists (
      select 1 from sedes s where s.id = chequeos_ubicacion.sede_id and s.supervisor_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Tarea programada (Etapa 2): dispara el envío de chequeos cada hora.
-- No se ejecuta como parte de este archivo porque necesita el dominio de
-- producción y el secreto real de CRON_SECRET — correr una sola vez,
-- reemplazando esos dos valores, después de tener la app desplegada.
-- Ver PRESENTISMO_SETUP.md.
-- ---------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'enviar-chequeos-presentismo',
--   '0 * * * *', -- todas las horas, en punto
--   $$
--   select net.http_post(
--     url := 'https://TU-DOMINIO/presentismo/api/cron/enviar-chequeos',
--     headers := jsonb_build_object('Authorization', 'Bearer TU_CRON_SECRET', 'Content-Type', 'application/json'),
--     body := '{}'::jsonb
--   );
--   $$
-- );
