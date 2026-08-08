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
