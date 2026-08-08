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
