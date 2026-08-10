import { diaSemanaActual } from './geo';
import { rangoDiaActualISO } from './fecha';
import type { crearClienteServidor } from './supabase-server';
import type { EmpleadoSede, Marcacion, Sede } from './database.types';

type ClienteRLS = Awaited<ReturnType<typeof crearClienteServidor>>;

export interface FilaReporte {
  empleadoId: string;
  sedeNombre: string;
  esFlotante: boolean;
  horaIngreso: string | null;
  horaEgreso: string | null;
  resultado: Marcacion['resultado'] | null;
  tarde: boolean;
  ausente: boolean;
  puntosRecorrido: number;
}

/**
 * Arma una fila por empleado con alguna asignación vigente para el día de la
 * fecha dada, cruzando sus marcaciones de ese día y, si trabaja en campo,
 * cuántos puntos de recorrido quedaron guardados. Usa el cliente pasado tal
 * cual (respeta el scope de RLS de quien lo pida: admin ve toda la
 * organización, supervisor solo sus sedes).
 */
export async function obtenerFilasReporte(
  supabase: ClienteRLS,
  fecha: Date
): Promise<FilaReporte[]> {
  const diaSemana = diaSemanaActual(fecha);
  const { inicio, fin } = rangoDiaActualISO(fecha);

  const [{ data: asignacionesData }, { data: marcacionesData }, { data: chequeosData }] =
    await Promise.all([
      supabase.from('empleado_sedes').select('*, sede:sedes(*)').contains('dias_semana', [diaSemana]),
      supabase
        .from('marcaciones')
        .select('*')
        .gte('timestamp_marcacion', inicio)
        .lte('timestamp_marcacion', fin)
        .order('timestamp_marcacion', { ascending: true }),
      supabase
        .from('chequeos_ubicacion')
        .select('empleado_id')
        .eq('estado', 'confirmado_campo')
        .gte('enviado_en', inicio)
        .lte('enviado_en', fin),
    ]);

  const asignaciones = (asignacionesData ?? []) as (EmpleadoSede & { sede: Sede | null })[];
  const marcaciones = (marcacionesData ?? []) as Marcacion[];

  const marcacionesPorEmpleado = new Map<string, Marcacion[]>();
  for (const m of marcaciones) {
    const lista = marcacionesPorEmpleado.get(m.empleado_id) ?? [];
    lista.push(m);
    marcacionesPorEmpleado.set(m.empleado_id, lista);
  }

  const puntosPorEmpleado = new Map<string, number>();
  for (const c of (chequeosData ?? []) as { empleado_id: string }[]) {
    puntosPorEmpleado.set(c.empleado_id, (puntosPorEmpleado.get(c.empleado_id) ?? 0) + 1);
  }

  // Una fila por empleado: si tiene varias asignaciones vigentes ese día, se
  // queda con la primera para mostrar sede/flotante (caso poco común).
  const asignacionPorEmpleado = new Map<string, EmpleadoSede & { sede: Sede | null }>();
  for (const a of asignaciones) {
    if (!asignacionPorEmpleado.has(a.empleado_id)) asignacionPorEmpleado.set(a.empleado_id, a);
  }

  const filas: FilaReporte[] = [];
  for (const [empleadoId, asignacion] of asignacionPorEmpleado) {
    const marcacionesEmpleado = marcacionesPorEmpleado.get(empleadoId) ?? [];
    const primerIngreso = marcacionesEmpleado.find((m) => m.tipo === 'ingreso');
    const ultimoEgreso = [...marcacionesEmpleado].reverse().find((m) => m.tipo === 'egreso');

    filas.push({
      empleadoId,
      sedeNombre: asignacion.sede?.nombre ?? '—',
      esFlotante: asignacion.es_flotante,
      horaIngreso: primerIngreso?.timestamp_marcacion ?? null,
      horaEgreso: ultimoEgreso?.timestamp_marcacion ?? null,
      resultado: primerIngreso?.resultado ?? null,
      tarde: primerIngreso?.tarde ?? false,
      ausente: !primerIngreso,
      puntosRecorrido: puntosPorEmpleado.get(empleadoId) ?? 0,
    });
  }

  return filas;
}

export function textoEstado(fila: FilaReporte): string {
  if (fila.ausente) return 'Ausente';
  if (fila.resultado === 'sin_geocerca') return fila.tarde ? 'Campo (tarde)' : 'Campo';
  if (fila.resultado === 'fuera_de_zona') return fila.tarde ? 'Fuera de zona (tarde)' : 'Fuera de zona';
  return fila.tarde ? 'Tarde' : 'A horario';
}
