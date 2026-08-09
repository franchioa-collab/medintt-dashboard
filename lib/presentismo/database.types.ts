// Tipos escritos a mano, en espejo de supabase/schema.sql.
// Si el esquema cambia en Supabase, actualizar este archivo (o regenerarlo con
// `supabase gen types typescript` una vez que el proyecto esté creado).

// 'super_admin' es el dueño de la plataforma (Medintt): da de alta empresas
// clientes nuevas. 'admin' administra una sola empresa cliente puntual.
export type RolUsuario = 'super_admin' | 'admin' | 'supervisor_sede' | 'empleado';
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

// 'pendiente' = avisado, esperando respuesta. 'confirmado_dentro'/'confirmado_fuera'
// = el empleado tocó el aviso y se comparó su ubicación contra la sede. 'vencido'
// = no respondió a tiempo. Solo confirmado_fuera guarda latitud/longitud.
export type EstadoChequeo = 'pendiente' | 'confirmado_dentro' | 'confirmado_fuera' | 'vencido';

export interface PushSubscriptionRow {
  id: string;
  empleado_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface ChequeoUbicacion {
  id: string;
  empleado_id: string;
  organizacion_id: string;
  sede_id: string | null;
  enviado_en: string;
  vence_en: string;
  respondido_en: string | null;
  estado: EstadoChequeo;
  latitud: number | null;
  longitud: number | null;
  distancia_metros: number | null;
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
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Partial<PushSubscriptionRow>;
        Update: Partial<PushSubscriptionRow>;
      };
      chequeos_ubicacion: {
        Row: ChequeoUbicacion;
        Insert: Partial<ChequeoUbicacion>;
        Update: Partial<ChequeoUbicacion>;
      };
    };
  };
}
