# Código fuente completo — Módulo de Presentismo

Este documento junta, en un solo archivo, el código completo del módulo de
presentismo (Etapa 1) tal como está desplegado en producción a la fecha de
este documento. Sirve como respaldo de referencia y como material de consulta
para replicarlo o modificarlo.

**Importante**: la copia viva y actualizada del código está en el repositorio
de GitHub (`franchioa-collab/medintt-dashboard`, rama `main`). Este documento
es una foto fija — si el código cambia después de generarlo, este archivo
queda desactualizado. Para trabajar sobre el código real (agregar una función,
corregir un bug, etc.), siempre hay que partir del repositorio, no de este
documento.

## Cómo está organizado

- `app/presentismo/` — páginas y rutas de API del módulo (Next.js App Router).
- `components/presentismo/` — componentes de interfaz reutilizables.
- `lib/presentismo/` — lógica de negocio, tipos y clientes de Supabase.
- `hooks/useUbicacionActual.ts` — hook de geolocalización del navegador.
- `middleware.ts` — protección de rutas y manejo de sesión (raíz del proyecto).
- `supabase/schema.sql` — esquema completo de base de datos y seguridad (RLS).
- `public/presentismo/` — ícono de la PWA.

Además de este módulo, el proyecto completo depende de:
- `package.json` (dependencias) — ver el repositorio.
- Variables de entorno documentadas en `.env.local.example` y en
  `PRESENTISMO_SETUP.md`.

---

## `supabase/schema.sql`

```sql
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
```

---

## `middleware.ts`

```tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esRutaPublica = pathname === '/presentismo/login';
  // Las rutas de API hacen su propia verificación de sesión y devuelven JSON;
  // no deben redirigirse a la pantalla de login.
  const esApi = pathname.startsWith('/presentismo/api/');

  if (!user && !esApi && pathname.startsWith('/presentismo') && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/presentismo/login';
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (user && esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/presentismo';
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}

export const config = {
  // Excluye el manifest y el ícono de la PWA (deben poder pedirse sin sesión)
  // y las rutas de API (manejan su propia autenticación y devuelven JSON).
  matcher: ['/presentismo', '/presentismo/((?!manifest\\.webmanifest|icon\\.svg).*)'],
};
```

---

## `hooks/useUbicacionActual.ts`

```tsx
'use client';

import { useCallback, useState } from 'react';
import type { CoordenadasActuales, ErrorGeolocalizacion } from '@/lib/presentismo/types';

interface EstadoUbicacion {
  cargando: boolean;
  coordenadas: CoordenadasActuales | null;
  error: ErrorGeolocalizacion | null;
}

function mapearError(error: GeolocationPositionError): ErrorGeolocalizacion {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'permiso_denegado';
    case error.TIMEOUT:
      return 'tiempo_agotado';
    default:
      return 'no_disponible';
  }
}

export interface ResultadoUbicacion {
  coordenadas: CoordenadasActuales | null;
  error: ErrorGeolocalizacion | null;
}

/** Pide la posición GPS actual del dispositivo (una sola lectura, alta precisión). */
export function useUbicacionActual() {
  const [estado, setEstado] = useState<EstadoUbicacion>({
    cargando: false,
    coordenadas: null,
    error: null,
  });

  const obtenerUbicacion = useCallback((): Promise<ResultadoUbicacion> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const resultado: ResultadoUbicacion = { coordenadas: null, error: 'no_soportado' };
      setEstado({ cargando: false, ...resultado });
      return Promise.resolve(resultado);
    }

    setEstado((prev) => ({ ...prev, cargando: true, error: null }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (posicion) => {
          const coordenadas: CoordenadasActuales = {
            lat: posicion.coords.latitude,
            lon: posicion.coords.longitude,
            precisionMetros: posicion.coords.accuracy ?? null,
          };
          setEstado({ cargando: false, coordenadas, error: null });
          resolve({ coordenadas, error: null });
        },
        (error) => {
          const errorMapeado = mapearError(error);
          setEstado({ cargando: false, coordenadas: null, error: errorMapeado });
          resolve({ coordenadas: null, error: errorMapeado });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  return { ...estado, obtenerUbicacion };
}
```

---

## `lib/presentismo/database.types.ts`

```tsx
// Tipos escritos a mano, en espejo de supabase/schema.sql.
// Si el esquema cambia en Supabase, actualizar este archivo (o regenerarlo con
// `supabase gen types typescript` una vez que el proyecto esté creado).

export type RolUsuario = 'admin' | 'supervisor_sede' | 'empleado';
export type TipoMarcacion = 'ingreso' | 'egreso';
export type ResultadoValidacion = 'dentro_de_zona' | 'fuera_de_zona';

export interface Organizacion {
  id: string;
  nombre: string;
  logo_url: string | null;
  activa: boolean;
  created_at: string;
}

export interface Perfil {
  id: string;
  organizacion_id: string;
  nombre_completo: string;
  rol: RolUsuario;
  activo: boolean;
  consentimiento_aceptado_at: string | null;
  created_at: string;
}

export interface Sede {
  id: string;
  organizacion_id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
  supervisor_id: string | null;
  created_at: string;
}

export interface EmpleadoSede {
  id: string;
  empleado_id: string;
  sede_id: string;
  dias_semana: number[];
  hora_inicio: string;
  hora_fin: string;
  created_at: string;
}

export interface Marcacion {
  id: string;
  empleado_id: string;
  organizacion_id: string;
  tipo: TipoMarcacion;
  timestamp_marcacion: string;
  latitud: number;
  longitud: number;
  precision_metros: number | null;
  sede_id: string | null;
  distancia_metros: number | null;
  resultado: ResultadoValidacion;
  tarde: boolean;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      organizaciones: { Row: Organizacion; Insert: Partial<Organizacion>; Update: Partial<Organizacion> };
      perfiles: { Row: Perfil; Insert: Partial<Perfil>; Update: Partial<Perfil> };
      sedes: { Row: Sede; Insert: Partial<Sede>; Update: Partial<Sede> };
      empleado_sedes: { Row: EmpleadoSede; Insert: Partial<EmpleadoSede>; Update: Partial<EmpleadoSede> };
      marcaciones: { Row: Marcacion; Insert: Partial<Marcacion>; Update: Partial<Marcacion> };
    };
  };
}
```

---

## `lib/presentismo/types.ts`

```tsx
export type EstadoPresentismo = 'a_horario' | 'tarde' | 'fuera_de_zona' | 'ausente';

export interface CoordenadasActuales {
  lat: number;
  lon: number;
  precisionMetros: number | null;
}

export type ErrorGeolocalizacion =
  | 'permiso_denegado'
  | 'no_disponible'
  | 'tiempo_agotado'
  | 'no_soportado';
```

---

## `lib/presentismo/constants.ts`

```tsx
export const TOLERANCIA_TARDE_MINUTOS = 15;

export const RADIO_METROS_DEFAULT = 400;

export const DIAS_SEMANA = [
  { valor: 1, nombre: 'Lunes', abrev: 'Lun' },
  { valor: 2, nombre: 'Martes', abrev: 'Mar' },
  { valor: 3, nombre: 'Miércoles', abrev: 'Mié' },
  { valor: 4, nombre: 'Jueves', abrev: 'Jue' },
  { valor: 5, nombre: 'Viernes', abrev: 'Vie' },
  { valor: 6, nombre: 'Sábado', abrev: 'Sáb' },
  { valor: 7, nombre: 'Domingo', abrev: 'Dom' },
] as const;

export const DIAS_HABILES_DEFAULT = [1, 2, 3, 4, 5];
```

---

## `lib/presentismo/fecha.ts`

```tsx
import { ZONA_HORARIA_DEFAULT } from './geo';

/** Fecha en formato YYYY-MM-DD según la zona horaria indicada. */
export function fechaLocalYMD(fecha: Date = new Date(), zonaHoraria: string = ZONA_HORARIA_DEFAULT): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

/**
 * Rango [inicio, fin] del día "de hoy" en la zona horaria dada, como ISO
 * strings en UTC listos para filtrar timestamp_marcacion en Supabase.
 * Argentina no tiene horario de verano (offset fijo -03:00), por eso se
 * puede calcular sin depender de una librería de zonas horarias.
 */
export function rangoDiaActualISO(
  fecha: Date = new Date(),
  zonaHoraria: string = ZONA_HORARIA_DEFAULT
): { inicio: string; fin: string } {
  const ymd = fechaLocalYMD(fecha, zonaHoraria);
  return {
    inicio: new Date(`${ymd}T00:00:00-03:00`).toISOString(),
    fin: new Date(`${ymd}T23:59:59.999-03:00`).toISOString(),
  };
}
```

---

## `lib/presentismo/geo.ts`

```tsx
import type { EmpleadoSede, Sede } from './database.types';
import { TOLERANCIA_TARDE_MINUTOS } from './constants';

/** Distancia entre dos coordenadas GPS, en metros (fórmula de Haversine). */
export function calcularDistanciaMetros(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * El servidor (Vercel) corre en UTC, así que la hora y el día de la semana se
 * calculan siempre en esta zona horaria en vez de con los métodos locales de
 * Date, para que "tarde" y los días configurados coincidan con la hora real
 * en Argentina sin importar dónde corra el proceso.
 */
export const ZONA_HORARIA_DEFAULT = 'America/Argentina/Buenos_Aires';

const MAPA_DIA_SEMANA: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function partesFechaEnZona(fecha: Date, zonaHoraria: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zonaHoraria,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const partes = formatter.formatToParts(fecha);
  const obtener = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  const minutosDelDia = Number(obtener('hour')) * 60 + Number(obtener('minute'));
  const diaSemana = MAPA_DIA_SEMANA[obtener('weekday')] ?? 1;
  return { minutosDelDia, diaSemana };
}

/** 1=lunes ... 7=domingo, para que coincida con la columna dias_semana de empleado_sedes. */
export function diaSemanaActual(
  fecha: Date = new Date(),
  zonaHoraria: string = ZONA_HORARIA_DEFAULT
): number {
  return partesFechaEnZona(fecha, zonaHoraria).diaSemana;
}

function minutosDeHora(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function horaEnRango(
  fecha: Date,
  horaInicio: string,
  horaFin: string,
  zonaHoraria: string = ZONA_HORARIA_DEFAULT
): boolean {
  const actual = partesFechaEnZona(fecha, zonaHoraria).minutosDelDia;
  return actual >= minutosDeHora(horaInicio) && actual <= minutosDeHora(horaFin);
}

export function esTarde(
  fecha: Date,
  horaInicio: string,
  toleranciaMinutos: number = TOLERANCIA_TARDE_MINUTOS,
  zonaHoraria: string = ZONA_HORARIA_DEFAULT
): boolean {
  const actual = partesFechaEnZona(fecha, zonaHoraria).minutosDelDia;
  return actual > minutosDeHora(horaInicio) + toleranciaMinutos;
}

export interface AsignacionConSede {
  asignacion: EmpleadoSede;
  sede: Sede;
}

export interface EvaluacionUbicacion {
  asignacion: EmpleadoSede;
  sede: Sede;
  distanciaMetros: number;
  dentroDeZona: boolean;
}

/** Asignaciones cuyo día de la semana configurado incluye el día actual. */
export function sedesVigentesHoy(
  asignaciones: AsignacionConSede[],
  fecha: Date = new Date()
): AsignacionConSede[] {
  const diaActual = diaSemanaActual(fecha);
  return asignaciones.filter(({ asignacion }) => asignacion.dias_semana.includes(diaActual));
}

/**
 * De las sedes asignadas al empleado que aplican hoy, devuelve la más
 * relevante para el marcado: preferimos una donde esté efectivamente dentro
 * de zona; si no está dentro de ninguna, devolvemos la más cercana para poder
 * registrar el resultado "fuera_de_zona" contra la sede más probable.
 * Se filtra solo por día de la semana (no por rango horario exacto) para que
 * un ingreso un poco antes o después del horario configurado igual se pueda
 * validar geográficamente; el rango horario exacto se usa para el monitoreo
 * periódico (Etapa 2) y para determinar si el ingreso llegó tarde.
 * Si el empleado no tiene ninguna sede asignada para hoy, devuelve null.
 */
export function evaluarUbicacionContraSedes(
  asignaciones: AsignacionConSede[],
  lat: number,
  lon: number,
  fecha: Date = new Date()
): EvaluacionUbicacion | null {
  const vigentesHoy = sedesVigentesHoy(asignaciones, fecha);

  if (vigentesHoy.length === 0) return null;

  const conDistancia: EvaluacionUbicacion[] = vigentesHoy.map(({ asignacion, sede }) => {
    const distanciaMetros = calcularDistanciaMetros(lat, lon, sede.latitud, sede.longitud);
    return {
      asignacion,
      sede,
      distanciaMetros,
      dentroDeZona: distanciaMetros <= sede.radio_metros,
    };
  });

  const dentro = conDistancia.filter((c) => c.dentroDeZona);
  const candidatas = dentro.length > 0 ? dentro : conDistancia;

  return candidatas.sort((a, b) => a.distanciaMetros - b.distanciaMetros)[0];
}
```

---

## `lib/presentismo/sesion.ts`

```tsx
import { cache } from 'react';
import { crearClienteServidor } from './supabase-server';
import type { Organizacion, Perfil } from './database.types';

export interface SesionActual {
  userId: string;
  email: string | undefined;
  perfil: Perfil;
  organizacion: Organizacion;
}

/**
 * Trae el usuario logueado junto con su perfil y organización. null si no hay
 * sesión válida. Envuelta en `cache()` para que layout y page (que corren en
 * el mismo render) no dupliquen las consultas a Supabase.
 */
export const obtenerSesionActual = cache(async (): Promise<SesionActual | null> => {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (!perfil || !perfil.activo) return null;

  const { data: organizacion } = await supabase
    .from('organizaciones')
    .select('*')
    .eq('id', perfil.organizacion_id)
    .single();
  if (!organizacion) return null;

  return { userId: user.id, email: user.email, perfil, organizacion };
});
```

---

## `lib/presentismo/supabase-browser.ts`

```tsx
import { createBrowserClient } from '@supabase/ssr';

export function crearClienteBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

---

## `lib/presentismo/supabase-server.ts`

```tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Nota: no se usa el generic <Database> de supabase-js acá; el tipado de
// filas se resuelve con los tipos de database.types.ts al leer los datos
// (ver los `as Perfil[]`, etc. en las páginas), para no pelear con la forma
// exacta que supabase-js espera del generic Database.

/** Cliente para Server Components / Route Handlers, con la sesión del usuario logueado. */
export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // set() puede fallar si se llama desde un Server Component; el
            // middleware ya se encarga de refrescar la sesión en ese caso.
          }
        },
      },
    }
  );
}

/**
 * Cliente administrativo con la service role key: ignora RLS.
 * Usar SOLO en Route Handlers server-side, y siempre después de verificar
 * que quien hace la llamada tiene rol 'admin' en su propia organización.
 */
export function crearClienteAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

---

## `components/presentismo/BadgeResultado.tsx`

```tsx
import type { ResultadoValidacion } from '@/lib/presentismo/database.types';

export default function BadgeResultado({
  resultado,
  tarde,
}: {
  resultado: ResultadoValidacion;
  tarde: boolean;
}) {
  const dentro = resultado === 'dentro_de_zona';

  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className={dentro ? 'text-green-700' : 'text-red-600 font-medium'}>
        {dentro ? 'En zona' : 'Fuera de zona'}
      </span>
      {tarde && (
        <span className="px-1.5 py-0.5 rounded bg-amarillo text-gray-900 text-xs font-medium">
          Tarde
        </span>
      )}
    </span>
  );
}
```

---

## `components/presentismo/EncabezadoOrganizacion.tsx`

```tsx
import type { Organizacion, Perfil } from '@/lib/presentismo/database.types';
import LogoutButton from './LogoutButton';

const NOMBRES_ROL: Record<Perfil['rol'], string> = {
  admin: 'Administrador',
  supervisor_sede: 'Supervisor de sede',
  empleado: 'Empleado',
};

export default function EncabezadoOrganizacion({
  organizacion,
  perfil,
}: {
  organizacion: Organizacion;
  perfil: Perfil;
}) {
  // Por ahora todas las organizaciones ven la marca Medintt. Si en el futuro
  // se carga un logo propio (organizacion.logo_url), se muestra automáticamente.
  return (
    <header className="bg-navy text-white shadow-md">
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {organizacion.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organizacion.logo_url}
              alt={organizacion.nombre}
              className="h-9 w-9 rounded object-contain bg-white shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-bold truncate">
              {organizacion.logo_url ? organizacion.nombre : 'Medintt · Presentismo'}
            </p>
            <p className="text-xs text-celeste truncate">
              {perfil.nombre_completo} · {NOMBRES_ROL[perfil.rol]}
            </p>
          </div>
        </div>
        <LogoutButton />
      </div>
    </header>
  );
}
```

---

## `components/presentismo/FormularioCambiarPassword.tsx`

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { crearClienteBrowser } from '@/lib/presentismo/supabase-browser';

export default function FormularioCambiarPassword() {
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setEnviando(true);
    const supabase = crearClienteBrowser();
    const { error: errorSupabase } = await supabase.auth.updateUser({ password });
    setEnviando(false);

    if (errorSupabase) {
      setError('No pudimos actualizar tu contraseña. Probá de nuevo.');
      return;
    }

    setPassword('');
    setConfirmacion('');
    setOk(true);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 space-y-3 max-w-sm">
      <h2 className="text-sm font-bold text-gray-700">Cambiar contraseña</h2>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contraseña</label>
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Repetir contraseña</label>
        <input
          required
          type="password"
          minLength={8}
          value={confirmacion}
          onChange={(e) => setConfirmacion(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-green-700">Contraseña actualizada.</p>}

      <button
        type="submit"
        disabled={enviando}
        className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  );
}
```

---

## `components/presentismo/LogoutButton.tsx`

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { crearClienteBrowser } from '@/lib/presentismo/supabase-browser';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = crearClienteBrowser();
    await supabase.auth.signOut();
    router.push('/presentismo/login');
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="text-sm text-white/80 hover:text-white underline">
      Salir
    </button>
  );
}
```

---

## `components/presentismo/NavPresentismo.tsx`

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { RolUsuario } from '@/lib/presentismo/database.types';

const ITEMS: { href: string; label: string; roles: RolUsuario[] }[] = [
  { href: '/presentismo', label: 'Marcar', roles: ['admin', 'supervisor_sede', 'empleado'] },
  { href: '/presentismo/historial', label: 'Mi historial', roles: ['admin', 'supervisor_sede', 'empleado'] },
  { href: '/presentismo/admin', label: 'Presentismo del equipo', roles: ['admin', 'supervisor_sede'] },
  { href: '/presentismo/admin/sedes', label: 'Sedes', roles: ['admin'] },
  { href: '/presentismo/admin/empleados', label: 'Empleados', roles: ['admin'] },
  { href: '/presentismo/cuenta', label: 'Mi cuenta', roles: ['admin', 'supervisor_sede', 'empleado'] },
];

export default function NavPresentismo({ rol }: { rol: RolUsuario }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => item.roles.includes(rol));

  return (
    <nav className="bg-white border-b border-gray-200 overflow-x-auto">
      <div className="max-w-3xl mx-auto px-4 flex gap-1">
        {items.map((item) => {
          const activo = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap px-3 py-3 text-sm font-medium border-b-2 transition-colors ${
                activo ? 'border-celeste text-navy' : 'border-transparent text-gray-500 hover:text-navy'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

---

## `components/presentismo/PanelMarcado.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUbicacionActual } from '@/hooks/useUbicacionActual';
import type { ErrorGeolocalizacion } from '@/lib/presentismo/types';
import type { TipoMarcacion } from '@/lib/presentismo/database.types';

const MENSAJES_ERROR: Record<ErrorGeolocalizacion, string> = {
  permiso_denegado: 'Activá el permiso de ubicación en tu celular para poder marcar.',
  tiempo_agotado: 'No pudimos obtener tu ubicación a tiempo. Probá de nuevo.',
  no_disponible: 'No pudimos obtener tu ubicación. Revisá que el GPS esté activado.',
  no_soportado: 'Tu navegador no soporta geolocalización.',
};

interface Props {
  proximaAccion: TipoMarcacion;
}

export default function PanelMarcado({ proximaAccion }: Props) {
  const router = useRouter();
  const { obtenerUbicacion } = useUbicacionActual();
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: 'ok' | 'error'; mensaje: string } | null>(null);

  async function marcar() {
    setProcesando(true);
    setResultado(null);

    const { coordenadas, error } = await obtenerUbicacion();
    if (!coordenadas) {
      setProcesando(false);
      setResultado({ tipo: 'error', mensaje: MENSAJES_ERROR[error ?? 'no_disponible'] });
      return;
    }

    const res = await fetch('/presentismo/api/marcar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: proximaAccion,
        lat: coordenadas.lat,
        lon: coordenadas.lon,
        precisionMetros: coordenadas.precisionMetros,
      }),
    });

    setProcesando(false);

    if (!res.ok) {
      setResultado({ tipo: 'error', mensaje: 'No pudimos registrar tu marcación. Probá de nuevo.' });
      return;
    }

    const { marcacion } = await res.json();
    const dentro = marcacion.resultado === 'dentro_de_zona';
    const partes = [proximaAccion === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado'];
    if (!dentro) partes.push('fuera del área asignada');
    if (marcacion.tarde) partes.push('tarde');

    setResultado({ tipo: 'ok', mensaje: partes.join(' — ') });
    router.refresh();
  }

  const label = proximaAccion === 'ingreso' ? 'Marcar ingreso' : 'Marcar egreso';

  return (
    <div className="bg-white rounded-lg shadow-md p-6 text-center space-y-4">
      <button
        onClick={marcar}
        disabled={procesando}
        className={`w-full rounded-md py-4 text-lg font-bold text-white disabled:opacity-50 ${
          proximaAccion === 'ingreso' ? 'bg-green-600' : 'bg-navy'
        }`}
      >
        {procesando ? 'Obteniendo ubicación…' : label}
      </button>

      {resultado && (
        <p className={`text-sm ${resultado.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
          {resultado.mensaje}
        </p>
      )}
    </div>
  );
}
```

---

## `components/presentismo/PantallaConsentimiento.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PantallaConsentimiento() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function aceptar() {
    setCargando(true);
    setError(null);

    const res = await fetch('/presentismo/api/consentimiento', { method: 'POST' });

    if (!res.ok) {
      setCargando(false);
      setError('No pudimos guardar tu aceptación. Probá de nuevo.');
      return;
    }

    router.refresh();
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <h2 className="text-lg font-bold text-navy">Antes de empezar</h2>
      <p className="text-sm text-gray-700">
        Para marcar tu ingreso y egreso, esta app necesita tu ubicación GPS en el momento exacto
        en que marcás. Esto es lo que hacemos con esa información:
      </p>
      <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1.5">
        <li>Guardamos tu ubicación solo en el momento en que marcás ingreso o egreso.</li>
        <li>
          Durante tu horario laboral, la app puede verificar cada tanto si seguís dentro del área
          asignada. A tu empleador solo le llega si estás &ldquo;dentro&rdquo; o
          &ldquo;fuera&rdquo; del área — nunca tu ubicación exacta ni tu recorrido.
        </li>
        <li>Fuera de tu horario laboral, la app no accede a tu ubicación bajo ninguna circunstancia.</li>
        <li>No se guarda un historial continuo de posiciones, solo los eventos de marcado.</li>
        <li>Podés consultar tu propio historial de marcaciones cuando quieras.</li>
      </ul>
      <p className="text-xs text-gray-500">
        Tratamiento de datos conforme a la Ley 25.326 de Protección de Datos Personales.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={aceptar}
        disabled={cargando}
        className="w-full bg-navy text-white rounded-md py-3 font-medium disabled:opacity-50"
      >
        {cargando ? 'Guardando…' : 'Entiendo y acepto'}
      </button>
    </div>
  );
}
```

---

## `components/presentismo/admin/BotonEliminarAsignacion.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BotonEliminarAsignacion({ asignacionId }: { asignacionId: string }) {
  const router = useRouter();
  const [eliminando, setEliminando] = useState(false);

  async function handleClick() {
    setEliminando(true);
    const res = await fetch(`/presentismo/api/admin/asignaciones/${asignacionId}`, {
      method: 'DELETE',
    });
    setEliminando(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={eliminando}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      {eliminando ? 'Quitando…' : 'Quitar'}
    </button>
  );
}
```

---

## `components/presentismo/admin/FormularioAsignacion.tsx`

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DIAS_SEMANA, DIAS_HABILES_DEFAULT } from '@/lib/presentismo/constants';
import type { Sede } from '@/lib/presentismo/database.types';

export default function FormularioAsignacion({
  empleadoId,
  sedes,
}: {
  empleadoId: string;
  sedes: Sede[];
}) {
  const router = useRouter();
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? '');
  const [diasSemana, setDiasSemana] = useState<number[]>(DIAS_HABILES_DEFAULT);
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFin, setHoraFin] = useState('17:00');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDia(dia: number) {
    setDiasSemana((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort()
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sedeId || diasSemana.length === 0) {
      setError('Elegí una sede y al menos un día.');
      return;
    }

    setEnviando(true);
    setError(null);

    const res = await fetch('/presentismo/api/admin/asignaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empleadoId, sedeId, diasSemana, horaInicio, horaFin }),
    });

    setEnviando(false);

    if (!res.ok) {
      setError('No pudimos guardar la asignación.');
      return;
    }

    router.refresh();
  }

  if (sedes.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Primero cargá al menos una sede en{' '}
        <a href="/presentismo/admin/sedes" className="text-celeste underline">
          Sedes
        </a>
        .
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 space-y-3">
      <h2 className="text-sm font-bold text-gray-700">Asignar sede y horario</h2>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Sede</label>
        <select
          value={sedeId}
          onChange={(e) => setSedeId(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Días</label>
        <div className="flex flex-wrap gap-2">
          {DIAS_SEMANA.map((d) => (
            <button
              type="button"
              key={d.valor}
              onClick={() => toggleDia(d.valor)}
              className={`px-2 py-1 rounded text-xs border ${
                diasSemana.includes(d.valor)
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              {d.abrev}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hora inicio</label>
          <input
            required
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hora fin</label>
          <input
            required
            type="time"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? 'Guardando…' : 'Asignar'}
      </button>
    </form>
  );
}
```

---

## `components/presentismo/admin/FormularioEmpleado.tsx`

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { RolUsuario } from '@/lib/presentismo/database.types';

const OPCIONES_ROL: { valor: RolUsuario; etiqueta: string }[] = [
  { valor: 'empleado', etiqueta: 'Empleado' },
  { valor: 'supervisor_sede', etiqueta: 'Supervisor de sede' },
  { valor: 'admin', etiqueta: 'Administrador' },
];

export default function FormularioEmpleado() {
  const router = useRouter();
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RolUsuario>('empleado');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    setPasswordTemporal(null);

    const res = await fetch('/presentismo/api/admin/empleados', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombreCompleto, email, rol }),
    });

    setEnviando(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(
        data?.error === 'email_en_uso'
          ? 'Ese email ya está registrado.'
          : 'No pudimos crear el empleado. Revisá los datos.'
      );
      return;
    }

    const { passwordTemporal: temp } = await res.json();
    setPasswordTemporal(temp);
    setNombreCompleto('');
    setEmail('');
    setRol('empleado');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 space-y-3">
      <h2 className="text-sm font-bold text-gray-700">Nuevo empleado</h2>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
        <input
          required
          value={nombreCompleto}
          onChange={(e) => setNombreCompleto(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Rol</label>
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as RolUsuario)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
        >
          {OPCIONES_ROL.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {passwordTemporal && (
        <div className="bg-amarillo/20 border border-amarillo rounded-md p-3 text-sm text-gray-800">
          <p className="font-medium">Empleado creado.</p>
          <p>
            Contraseña temporal: <span className="font-mono font-bold">{passwordTemporal}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Compartila de forma segura. El empleado puede cambiarla desde su cuenta.
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? 'Creando…' : 'Crear empleado'}
      </button>
    </form>
  );
}
```

---

## `components/presentismo/admin/FormularioSede.tsx`

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useUbicacionActual } from '@/hooks/useUbicacionActual';
import { RADIO_METROS_DEFAULT } from '@/lib/presentismo/constants';

export default function FormularioSede() {
  const router = useRouter();
  const { obtenerUbicacion, cargando: obteniendoUbicacion } = useUbicacionActual();
  const [nombre, setNombre] = useState('');
  const [latitud, setLatitud] = useState('');
  const [longitud, setLongitud] = useState('');
  const [radioMetros, setRadioMetros] = useState(String(RADIO_METROS_DEFAULT));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function usarUbicacionActual() {
    const { coordenadas } = await obtenerUbicacion();
    if (coordenadas) {
      setLatitud(coordenadas.lat.toFixed(6));
      setLongitud(coordenadas.lon.toFixed(6));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const res = await fetch('/presentismo/api/admin/sedes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        latitud: Number(latitud),
        longitud: Number(longitud),
        radioMetros: Number(radioMetros),
      }),
    });

    setEnviando(false);

    if (!res.ok) {
      setError('No pudimos guardar la sede. Revisá los datos.');
      return;
    }

    setNombre('');
    setLatitud('');
    setLongitud('');
    setRadioMetros(String(RADIO_METROS_DEFAULT));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-4 space-y-3">
      <h2 className="text-sm font-bold text-gray-700">Nueva sede</h2>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nombre</label>
        <input
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Planta Norte"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Latitud</label>
          <input
            required
            type="number"
            step="any"
            value={latitud}
            onChange={(e) => setLatitud(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Longitud</label>
          <input
            required
            type="number"
            step="any"
            value={longitud}
            onChange={(e) => setLongitud(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={usarUbicacionActual}
        disabled={obteniendoUbicacion}
        className="text-xs text-celeste underline disabled:opacity-50"
      >
        {obteniendoUbicacion ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}
      </button>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Radio de tolerancia (metros)</label>
        <input
          required
          type="number"
          min={10}
          value={radioMetros}
          onChange={(e) => setRadioMetros(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {enviando ? 'Guardando…' : 'Guardar sede'}
      </button>
    </form>
  );
}
```

---

## `components/presentismo/admin/TogglesSupervisorSede.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Sede } from '@/lib/presentismo/database.types';

export default function TogglesSupervisorSede({
  empleadoId,
  sedes,
}: {
  empleadoId: string;
  sedes: Sede[];
}) {
  const router = useRouter();
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  async function toggle(sede: Sede, marcar: boolean) {
    setGuardandoId(sede.id);
    await fetch(`/presentismo/api/admin/sedes/${sede.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supervisorId: marcar ? empleadoId : null }),
    });
    setGuardandoId(null);
    router.refresh();
  }

  if (sedes.length === 0) {
    return <p className="text-sm text-gray-500">Todavía no hay sedes cargadas.</p>;
  }

  return (
    <div className="space-y-2">
      {sedes.map((sede) => {
        const esSupervisor = sede.supervisor_id === empleadoId;
        return (
          <label key={sede.id} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={esSupervisor}
              disabled={guardandoId === sede.id}
              onChange={(e) => toggle(sede, e.target.checked)}
            />
            {sede.nombre}
          </label>
        );
      })}
    </div>
  );
}
```

---

## `app/presentismo/layout.tsx`

```tsx
import type { Metadata, Viewport } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Presentismo',
  description: 'Control de presentismo con geolocalización',
  manifest: '/presentismo/manifest.webmanifest',
  icons: {
    icon: '/presentismo/icon.svg',
    apple: '/presentismo/icon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Presentismo',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B2A4A',
};

export default function PresentismoRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
```

---

## `app/presentismo/login/page.tsx`

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteBrowser } from '@/lib/presentismo/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    const supabase = crearClienteBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setCargando(false);
      setError('Usuario o contraseña incorrectos.');
      return;
    }

    router.push('/presentismo');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-navy mb-1">Presentismo</h1>
        <p className="text-sm text-gray-500 mb-6">Ingresá con tu usuario</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-celeste"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-celeste"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-navy text-white rounded-md py-2 font-medium disabled:opacity-50"
          >
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

---

## `app/presentismo/manifest.webmanifest/route.ts`

```tsx
import { NextResponse } from 'next/server';

// Next.js 14 no soporta el archivo especial `manifest.ts` anidado dentro de un
// segmento (solo en la raíz de app/), así que se sirve a mano como Route Handler.
export function GET() {
  return NextResponse.json(
    {
      name: 'Presentismo',
      short_name: 'Presentismo',
      description: 'Marcado de ingreso y egreso con validación de ubicación',
      start_url: '/presentismo',
      scope: '/presentismo',
      display: 'standalone',
      background_color: '#F9FAFB',
      theme_color: '#0B2A4A',
      icons: [
        { src: '/presentismo/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: '/presentismo/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  );
}
```

---

## `app/presentismo/(app)/layout.tsx`

```tsx
import { redirect } from 'next/navigation';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import EncabezadoOrganizacion from '@/components/presentismo/EncabezadoOrganizacion';
import NavPresentismo from '@/components/presentismo/NavPresentismo';

export default async function PresentismoAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await obtenerSesionActual();
  if (!sesion) redirect('/presentismo/login');

  return (
    <div className="min-h-screen bg-gray-50">
      <EncabezadoOrganizacion organizacion={sesion.organizacion} perfil={sesion.perfil} />
      <NavPresentismo rol={sesion.perfil.rol} />
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
```

---

## `app/presentismo/(app)/page.tsx`

```tsx
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';
import { rangoDiaActualISO } from '@/lib/presentismo/fecha';
import PantallaConsentimiento from '@/components/presentismo/PantallaConsentimiento';
import PanelMarcado from '@/components/presentismo/PanelMarcado';
import BadgeResultado from '@/components/presentismo/BadgeResultado';
import type { Marcacion } from '@/lib/presentismo/database.types';

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export default async function PresentismoHomePage() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null; // el layout ya redirige a /presentismo/login

  if (!sesion.perfil.consentimiento_aceptado_at) {
    return <PantallaConsentimiento />;
  }

  const supabase = await crearClienteServidor();
  const { inicio, fin } = rangoDiaActualISO();

  const { data: marcacionesHoy } = await supabase
    .from('marcaciones')
    .select('*')
    .eq('empleado_id', sesion.userId)
    .gte('timestamp_marcacion', inicio)
    .lte('timestamp_marcacion', fin)
    .order('timestamp_marcacion', { ascending: true });

  const marcaciones = (marcacionesHoy ?? []) as Marcacion[];
  const ultima = marcaciones[marcaciones.length - 1];
  const proximaAccion = !ultima || ultima.tipo === 'egreso' ? 'ingreso' : 'egreso';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Hola, {sesion.perfil.nombre_completo.split(' ')[0]}</h1>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'America/Argentina/Buenos_Aires',
          })}
        </p>
      </div>

      <PanelMarcado proximaAccion={proximaAccion} />

      {marcaciones.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-2">Hoy</h2>
          <ul className="space-y-1.5">
            {marcaciones.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">
                  {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} · {formatearHora(m.timestamp_marcacion)}
                </span>
                <BadgeResultado resultado={m.resultado} tarde={m.tarde} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## `app/presentismo/(app)/historial/page.tsx`

```tsx
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';
import { fechaLocalYMD } from '@/lib/presentismo/fecha';
import BadgeResultado from '@/components/presentismo/BadgeResultado';
import type { Marcacion, Sede } from '@/lib/presentismo/database.types';

const LIMITE = 100;

type MarcacionConSede = Marcacion & { sede: Pick<Sede, 'nombre'> | null };

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function formatearFecha(ymd: string) {
  const [anio, mes, dia] = ymd.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default async function HistorialPage() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null; // el layout ya redirige a /presentismo/login

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from('marcaciones')
    .select('*, sede:sedes(nombre)')
    .eq('empleado_id', sesion.userId)
    .order('timestamp_marcacion', { ascending: false })
    .limit(LIMITE);

  const marcaciones = (data ?? []) as MarcacionConSede[];

  const grupos = new Map<string, MarcacionConSede[]>();
  for (const m of marcaciones) {
    const clave = fechaLocalYMD(new Date(m.timestamp_marcacion));
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(m);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-navy">Mi historial</h1>

      {grupos.size === 0 && (
        <p className="text-sm text-gray-500">Todavía no tenés marcaciones registradas.</p>
      )}

      {[...grupos.entries()].map(([fecha, items]) => (
        <div key={fecha} className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-2 capitalize">{formatearFecha(fecha)}</h2>
          <ul className="space-y-1.5">
            {items.map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm gap-2">
                <span className="text-gray-700 truncate">
                  {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} · {formatearHora(m.timestamp_marcacion)}
                  {m.sede?.nombre ? ` · ${m.sede.nombre}` : ''}
                </span>
                <BadgeResultado resultado={m.resultado} tarde={m.tarde} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

---

## `app/presentismo/(app)/cuenta/page.tsx`

```tsx
import FormularioCambiarPassword from '@/components/presentismo/FormularioCambiarPassword';

export default function CuentaPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-navy">Mi cuenta</h1>
      <FormularioCambiarPassword />
    </div>
  );
}
```

---

## `app/presentismo/(app)/admin/page.tsx`

```tsx
import { redirect } from 'next/navigation';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor, crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import BadgeResultado from '@/components/presentismo/BadgeResultado';
import type { Marcacion, Sede } from '@/lib/presentismo/database.types';

const LIMITE = 100;

type MarcacionConSede = Marcacion & { sede: Pick<Sede, 'nombre'> | null };

function formatearFechaHora(iso: string) {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

export default async function EquipoPage() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null;
  if (sesion.perfil.rol !== 'admin' && sesion.perfil.rol !== 'supervisor_sede') {
    redirect('/presentismo');
  }

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from('marcaciones')
    .select('*, sede:sedes(nombre)')
    .order('timestamp_marcacion', { ascending: false })
    .limit(LIMITE);

  const marcaciones = (data ?? []) as MarcacionConSede[];

  // La RLS de perfiles solo permite ver la fila propia (evita recursión); los
  // nombres de los empleados involucrados se resuelven aparte con el cliente
  // admin. La lista de marcaciones en sí ya viene scopeada por su propia RLS
  // (admin ve toda la organización, supervisor solo sus sedes).
  const empleadoIds = [...new Set(marcaciones.map((m) => m.empleado_id))];
  const admin = crearClienteAdmin();
  const { data: perfilesData } = await admin
    .from('perfiles')
    .select('id, nombre_completo')
    .in('id', empleadoIds.length > 0 ? empleadoIds : ['']);
  const nombrePorEmpleadoId = new Map(
    (perfilesData ?? []).map((p) => [p.id, p.nombre_completo])
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Presentismo del equipo</h1>
        <p className="text-sm text-gray-500">Últimas marcaciones registradas.</p>
      </div>

      <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
        {marcaciones.length === 0 && (
          <p className="p-4 text-sm text-gray-500">Todavía no hay marcaciones registradas.</p>
        )}
        {marcaciones.map((m) => (
          <div key={m.id} className="p-4 flex items-center justify-between text-sm gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate">
                {nombrePorEmpleadoId.get(m.empleado_id) ?? 'Empleado'}
              </p>
              <p className="text-gray-500 truncate">
                {m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} · {formatearFechaHora(m.timestamp_marcacion)}
                {m.sede?.nombre ? ` · ${m.sede.nombre}` : ''}
              </p>
            </div>
            <BadgeResultado resultado={m.resultado} tarde={m.tarde} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## `app/presentismo/(app)/admin/sedes/page.tsx`

```tsx
import { redirect } from 'next/navigation';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';
import FormularioSede from '@/components/presentismo/admin/FormularioSede';
import type { Sede } from '@/lib/presentismo/database.types';

export default async function SedesPage() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null;
  if (sesion.perfil.rol !== 'admin') redirect('/presentismo');

  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('sedes').select('*').order('nombre');
  const sedes = (data ?? []) as Sede[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">Sedes</h1>
        <p className="text-sm text-gray-500">
          Cada sede es un área geográfica válida para marcar presentismo. Un empleado puede tener
          varias sedes asignadas (su lugar habitual + sedes de clientes que visita).
        </p>
      </div>

      <FormularioSede />

      <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
        {sedes.length === 0 && (
          <p className="p-4 text-sm text-gray-500">Todavía no hay sedes cargadas.</p>
        )}
        {sedes.map((sede) => (
          <div key={sede.id} className="p-4 text-sm">
            <p className="font-medium text-gray-800">{sede.nombre}</p>
            <p className="text-gray-500">
              {sede.latitud.toFixed(5)}, {sede.longitud.toFixed(5)} · radio {sede.radio_metros} m
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## `app/presentismo/(app)/admin/empleados/page.tsx`

```tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import FormularioEmpleado from '@/components/presentismo/admin/FormularioEmpleado';
import type { Perfil } from '@/lib/presentismo/database.types';

const NOMBRES_ROL: Record<Perfil['rol'], string> = {
  admin: 'Administrador',
  supervisor_sede: 'Supervisor de sede',
  empleado: 'Empleado',
};

export default async function EmpleadosPage() {
  const sesion = await obtenerSesionActual();
  if (!sesion) return null;
  if (sesion.perfil.rol !== 'admin') redirect('/presentismo');

  // La RLS de perfiles solo permite ver la fila propia (evita recursión); el
  // listado de todo el equipo se hace con el cliente admin, ya filtrado a la
  // organización del que pidió la página (verificada arriba como admin).
  const admin = crearClienteAdmin();
  const { data } = await admin
    .from('perfiles')
    .select('*')
    .eq('organizacion_id', sesion.organizacion.id)
    .order('nombre_completo');
  const empleados = (data ?? []) as Perfil[];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-navy">Empleados</h1>

      <FormularioEmpleado />

      <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
        {empleados.map((emp) => (
          <Link
            key={emp.id}
            href={`/presentismo/admin/empleados/${emp.id}`}
            className="p-4 flex items-center justify-between text-sm hover:bg-gray-50"
          >
            <div>
              <p className="font-medium text-gray-800">{emp.nombre_completo}</p>
              <p className="text-gray-500">{NOMBRES_ROL[emp.rol]}</p>
            </div>
            {!emp.activo && (
              <span className="text-xs px-2 py-0.5 rounded bg-gray-200 text-gray-600">Inactivo</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

---

## `app/presentismo/(app)/admin/empleados/[id]/page.tsx`

```tsx
import { redirect, notFound } from 'next/navigation';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor, crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import { DIAS_SEMANA } from '@/lib/presentismo/constants';
import FormularioAsignacion from '@/components/presentismo/admin/FormularioAsignacion';
import BotonEliminarAsignacion from '@/components/presentismo/admin/BotonEliminarAsignacion';
import TogglesSupervisorSede from '@/components/presentismo/admin/TogglesSupervisorSede';
import type { EmpleadoSede, Perfil, Sede } from '@/lib/presentismo/database.types';

const NOMBRES_ROL: Record<Perfil['rol'], string> = {
  admin: 'Administrador',
  supervisor_sede: 'Supervisor de sede',
  empleado: 'Empleado',
};

function nombresDias(dias: number[]) {
  return dias
    .map((d) => DIAS_SEMANA.find((ds) => ds.valor === d)?.abrev)
    .filter(Boolean)
    .join(', ');
}

export default async function DetalleEmpleadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sesion = await obtenerSesionActual();
  if (!sesion) return null;
  if (sesion.perfil.rol !== 'admin') redirect('/presentismo');

  const supabase = await crearClienteServidor();
  // La RLS de perfiles solo permite ver la fila propia (evita recursión); se
  // busca al empleado con el cliente admin, filtrando por su organización.
  const admin = crearClienteAdmin();

  const [{ data: empleado }, { data: sedesData }, { data: asignacionesData }] = await Promise.all([
    admin.from('perfiles').select('*').eq('id', id).eq('organizacion_id', sesion.organizacion.id).single(),
    supabase.from('sedes').select('*').order('nombre'),
    supabase
      .from('empleado_sedes')
      .select('*, sede:sedes(*)')
      .eq('empleado_id', id),
  ]);

  if (!empleado) notFound();

  const sedes = (sedesData ?? []) as Sede[];
  const asignaciones = (asignacionesData ?? []) as (EmpleadoSede & { sede: Sede })[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-navy">{(empleado as Perfil).nombre_completo}</h1>
        <p className="text-sm text-gray-500">{NOMBRES_ROL[(empleado as Perfil).rol]}</p>
      </div>

      {(empleado as Perfil).rol === 'supervisor_sede' && (
        <div className="bg-white rounded-lg shadow-md p-4 space-y-2">
          <h2 className="text-sm font-bold text-gray-700">Sedes que supervisa</h2>
          <TogglesSupervisorSede empleadoId={id} sedes={sedes} />
        </div>
      )}

      <FormularioAsignacion empleadoId={id} sedes={sedes} />

      <div className="bg-white rounded-lg shadow-md divide-y divide-gray-100">
        <h2 className="text-sm font-bold text-gray-700 p-4 pb-0">Sedes y horarios asignados</h2>
        {asignaciones.length === 0 && (
          <p className="p-4 text-sm text-gray-500">Todavía no tiene sedes asignadas.</p>
        )}
        {asignaciones.map((a) => (
          <div key={a.id} className="p-4 flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-gray-800">{a.sede.nombre}</p>
              <p className="text-gray-500">
                {nombresDias(a.dias_semana)} · {a.hora_inicio.slice(0, 5)} a {a.hora_fin.slice(0, 5)}
              </p>
            </div>
            <BotonEliminarAsignacion asignacionId={a.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## `app/presentismo/api/marcar/route.ts`

```tsx
import { NextResponse } from 'next/server';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';
import { evaluarUbicacionContraSedes, esTarde, type AsignacionConSede } from '@/lib/presentismo/geo';
import type { EmpleadoSede, Sede } from '@/lib/presentismo/database.types';

interface CuerpoMarcar {
  tipo?: string;
  lat?: number;
  lon?: number;
  precisionMetros?: number | null;
}

export async function POST(request: Request) {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  }

  const { data: perfil } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
  if (!perfil || !perfil.activo) {
    return NextResponse.json({ error: 'perfil_invalido' }, { status: 403 });
  }
  if (!perfil.consentimiento_aceptado_at) {
    return NextResponse.json({ error: 'consentimiento_requerido' }, { status: 403 });
  }

  let body: CuerpoMarcar;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const { tipo, lat, lon, precisionMetros } = body;
  if ((tipo !== 'ingreso' && tipo !== 'egreso') || typeof lat !== 'number' || typeof lon !== 'number') {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }

  const { data: asignacionesRaw } = await supabase
    .from('empleado_sedes')
    .select('*, sede:sedes(*)')
    .eq('empleado_id', user.id);

  const asignaciones: AsignacionConSede[] = (asignacionesRaw ?? [])
    .filter((a: EmpleadoSede & { sede: Sede | null }) => a.sede)
    .map((a: EmpleadoSede & { sede: Sede | null }) => ({ asignacion: a, sede: a.sede as Sede }));

  const evaluacion = evaluarUbicacionContraSedes(asignaciones, lat, lon);

  const ahora = new Date();
  const tarde =
    tipo === 'ingreso' && evaluacion ? esTarde(ahora, evaluacion.asignacion.hora_inicio) : false;

  const { data: marcacion, error } = await supabase
    .from('marcaciones')
    .insert({
      empleado_id: user.id,
      organizacion_id: perfil.organizacion_id,
      tipo,
      timestamp_marcacion: ahora.toISOString(),
      latitud: lat,
      longitud: lon,
      precision_metros: precisionMetros ?? null,
      sede_id: evaluacion?.sede.id ?? null,
      distancia_metros: evaluacion?.distanciaMetros ?? null,
      resultado: evaluacion?.dentroDeZona ? 'dentro_de_zona' : 'fuera_de_zona',
      tarde,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'error_guardando' }, { status: 500 });
  }

  return NextResponse.json({ marcacion });
}
```

---

## `app/presentismo/api/consentimiento/route.ts`

```tsx
import { NextResponse } from 'next/server';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';

export async function POST() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  }

  const { error } = await supabase.rpc('aceptar_consentimiento');
  if (error) {
    return NextResponse.json({ error: 'error_guardando' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

---

## `app/presentismo/api/admin/sedes/route.ts`

```tsx
import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';

interface CuerpoSede {
  nombre?: string;
  latitud?: number;
  longitud?: number;
  radioMetros?: number;
}

export async function POST(request: Request) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  if (sesion.perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  let body: CuerpoSede;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const { nombre, latitud, longitud, radioMetros } = body;
  if (
    !nombre ||
    typeof latitud !== 'number' ||
    typeof longitud !== 'number' ||
    typeof radioMetros !== 'number' ||
    radioMetros < 10
  ) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }

  const supabase = await crearClienteServidor();
  const { data: sede, error } = await supabase
    .from('sedes')
    .insert({
      organizacion_id: sesion.organizacion.id,
      nombre,
      latitud,
      longitud,
      radio_metros: radioMetros,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'error_guardando' }, { status: 500 });
  }

  return NextResponse.json({ sede });
}
```

---

## `app/presentismo/api/admin/sedes/[id]/route.ts`

```tsx
import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';

/** Por ahora solo permite asignar/quitar el supervisor de la sede. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  if (sesion.perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  let body: { supervisorId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('sedes')
    .update({ supervisor_id: body.supervisorId ?? null })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'error_guardando' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

---

## `app/presentismo/api/admin/empleados/route.ts`

```tsx
import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import type { RolUsuario } from '@/lib/presentismo/database.types';

const ROLES_VALIDOS: RolUsuario[] = ['admin', 'supervisor_sede', 'empleado'];

interface CuerpoEmpleado {
  nombreCompleto?: string;
  email?: string;
  rol?: RolUsuario;
}

function generarPasswordTemporal(): string {
  const azar = () => Math.random().toString(36).slice(-4);
  return `${azar()}${azar()}-${azar()}`;
}

export async function POST(request: Request) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  if (sesion.perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  let body: CuerpoEmpleado;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const { nombreCompleto, email, rol } = body;
  if (!nombreCompleto || !email || !rol || !ROLES_VALIDOS.includes(rol)) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }

  const passwordTemporal = generarPasswordTemporal();
  const admin = crearClienteAdmin();

  const { data: nuevoUsuario, error: errorCreandoUsuario } = await admin.auth.admin.createUser({
    email,
    password: passwordTemporal,
    email_confirm: true,
  });

  if (errorCreandoUsuario || !nuevoUsuario?.user) {
    const enUso = errorCreandoUsuario?.message?.toLowerCase().includes('already');
    return NextResponse.json({ error: enUso ? 'email_en_uso' : 'error_creando_usuario' }, { status: 400 });
  }

  const { error: errorPerfil } = await admin.from('perfiles').insert({
    id: nuevoUsuario.user.id,
    organizacion_id: sesion.organizacion.id,
    nombre_completo: nombreCompleto,
    rol,
    activo: true,
  });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(nuevoUsuario.user.id);
    return NextResponse.json({ error: 'error_creando_perfil' }, { status: 500 });
  }

  return NextResponse.json({ passwordTemporal });
}
```

---

## `app/presentismo/api/admin/asignaciones/route.ts`

```tsx
import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';

interface CuerpoAsignacion {
  empleadoId?: string;
  sedeId?: string;
  diasSemana?: number[];
  horaInicio?: string;
  horaFin?: string;
}

export async function POST(request: Request) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  if (sesion.perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  let body: CuerpoAsignacion;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const { empleadoId, sedeId, diasSemana, horaInicio, horaFin } = body;
  if (
    !empleadoId ||
    !sedeId ||
    !Array.isArray(diasSemana) ||
    diasSemana.length === 0 ||
    !horaInicio ||
    !horaFin
  ) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }

  const supabase = await crearClienteServidor();
  const { data: asignacion, error } = await supabase
    .from('empleado_sedes')
    .insert({
      empleado_id: empleadoId,
      sede_id: sedeId,
      dias_semana: diasSemana,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
    })
    .select()
    .single();

  if (error) {
    const yaExiste = error.code === '23505';
    return NextResponse.json(
      { error: yaExiste ? 'asignacion_duplicada' : 'error_guardando' },
      { status: yaExiste ? 409 : 500 }
    );
  }

  return NextResponse.json({ asignacion });
}
```

---

## `app/presentismo/api/admin/asignaciones/[id]/route.ts`

```tsx
import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  if (sesion.perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('empleado_sedes').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'error_eliminando' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

---

## `public/presentismo/icon.svg`

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0B2A4A" />
  <path
    d="M256 120c-70.7 0-128 57.3-128 128 0 96 128 232 128 232s128-136 128-232c0-70.7-57.3-128-128-128z"
    fill="#3FB6D3"
  />
  <circle cx="256" cy="248" r="54" fill="#0B2A4A" />
</svg>
```

---

