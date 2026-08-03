export type EstadoTarea = 'Pendiente' | 'En curso' | 'Cumplido' | 'N/A';
export type TipoTarea = 'Obligación legal' | 'Estándar de certificación' | 'Buena práctica';
export type Frente =
  | '1. Exámenes por riesgo'
  | '2. Capacitaciones'
  | '3. Auditorías internas'
  | '4. Legajos'
  | '5. Devolución de hallazgos'
  | '6. Gestión y continuidad';
export type Mes = 'Ene' | 'Feb' | 'Mar' | 'Abr' | 'May' | 'Jun' | 'Jul' | 'Ago' | 'Sep' | 'Oct' | 'Nov' | 'Dic';
export type Rol = 'MT' | 'ENF' | 'ADM' | 'COORD-HS' | 'AUD' | 'GER-CLIENTE';

export interface Tarea {
  numero: number;
  frente: Frente;
  tarea: string;
  referenciaNormativa: string;
  tipo: TipoTarea;
  periodicidad: string;
  responsable: Rol[];
  colabora: Rol[];
  evidencia: string;
  estadosMes: {
    [key in Mes]: EstadoTarea;
  };
  observaciones: string;
}

export interface DatosEmpresa {
  id: string;
  nombre: string;
  tareas: Tarea[];
  error?: string;
}

export interface DatosDashboard {
  empresas: DatosEmpresa[];
  timestamp: string;
}

export interface EstadisticasEmpresa {
  empresa: string;
  totalTareas: number;
  cumplidas: number;
  porcentaje: number;
  obligacionesIncumplidas: number;
  severidad: 'verde' | 'amarillo' | 'rojo';
}
