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
