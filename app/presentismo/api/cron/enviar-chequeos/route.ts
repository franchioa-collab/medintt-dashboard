import { NextResponse } from 'next/server';
import { crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import { horaEnRango, diaSemanaActual } from '@/lib/presentismo/geo';
import { rangoDiaActualISO } from '@/lib/presentismo/fecha';
import { enviarPush } from '@/lib/presentismo/push';
import type { EmpleadoSede, Marcacion, Sede } from '@/lib/presentismo/database.types';

export const maxDuration = 60;

const MINUTOS_VENCIMIENTO = 10;
const MINUTOS_ANTIRREPETICION = 55;

type AsignacionConDetalle = EmpleadoSede & {
  sede: Sede | null;
  empleado: { id: string; organizacion_id: string; activo: boolean } | null;
};

/**
 * Disparada cada hora por un cron externo (ver supabase/schema.sql, pg_cron).
 * Vence los chequeos pendientes que pasaron su límite, y crea + notifica un
 * chequeo nuevo para cada empleado que esté "en curso" (marcó ingreso, no
 * egreso) y dentro de un horario asignado en este momento.
 */
export async function POST(request: Request) {
  const secretoEsperado = process.env.CRON_SECRET;
  const autorizacion = request.headers.get('authorization');
  if (!secretoEsperado || autorizacion !== `Bearer ${secretoEsperado}`) {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 401 });
  }

  const admin = crearClienteAdmin();
  const ahora = new Date();

  await admin
    .from('chequeos_ubicacion')
    .update({ estado: 'vencido' })
    .eq('estado', 'pendiente')
    .lt('vence_en', ahora.toISOString());

  const { data: asignacionesData } = await admin
    .from('empleado_sedes')
    .select('*, sede:sedes(*), empleado:perfiles(id, organizacion_id, activo)');

  const asignaciones = (asignacionesData ?? []) as AsignacionConDetalle[];

  const diaActual = diaSemanaActual(ahora);
  const activasAhora = asignaciones.filter(
    (a) =>
      a.sede &&
      a.empleado?.activo &&
      a.dias_semana.includes(diaActual) &&
      horaEnRango(ahora, a.hora_inicio, a.hora_fin)
  );

  if (activasAhora.length === 0) {
    return NextResponse.json({ enviados: 0, motivo: 'sin_asignaciones_activas_ahora' });
  }

  const empleadoIds = [...new Set(activasAhora.map((a) => a.empleado_id))];

  // "En curso": la última marcación de hoy fue un ingreso sin egreso posterior.
  const { inicio } = rangoDiaActualISO(ahora);
  const { data: marcacionesHoyData } = await admin
    .from('marcaciones')
    .select('empleado_id, tipo, timestamp_marcacion')
    .in('empleado_id', empleadoIds)
    .gte('timestamp_marcacion', inicio)
    .order('timestamp_marcacion', { ascending: true });

  const ultimoTipoPorEmpleado = new Map<string, Marcacion['tipo']>();
  for (const m of (marcacionesHoyData ?? []) as Pick<Marcacion, 'empleado_id' | 'tipo' | 'timestamp_marcacion'>[]) {
    ultimoTipoPorEmpleado.set(m.empleado_id, m.tipo);
  }
  const enCurso = new Set(
    [...ultimoTipoPorEmpleado.entries()].filter(([, tipo]) => tipo === 'ingreso').map(([id]) => id)
  );

  // No mandar de nuevo si ya se envió un chequeo hace poco (evita duplicados
  // si el disparador externo llega a correr dos veces cerca en el tiempo).
  const desde = new Date(ahora.getTime() - MINUTOS_ANTIRREPETICION * 60 * 1000).toISOString();
  const { data: recientesData } = await admin
    .from('chequeos_ubicacion')
    .select('empleado_id')
    .in('empleado_id', empleadoIds)
    .gte('enviado_en', desde);
  const yaAvisadosRecientemente = new Set((recientesData ?? []).map((c) => c.empleado_id as string));

  const candidatos = new Map<string, AsignacionConDetalle>();
  for (const a of activasAhora) {
    if (!enCurso.has(a.empleado_id)) continue;
    if (yaAvisadosRecientemente.has(a.empleado_id)) continue;
    if (!candidatos.has(a.empleado_id)) candidatos.set(a.empleado_id, a);
  }

  let enviados = 0;
  const venceEn = new Date(ahora.getTime() + MINUTOS_VENCIMIENTO * 60 * 1000).toISOString();

  for (const asignacion of candidatos.values()) {
    const { data: chequeo, error } = await admin
      .from('chequeos_ubicacion')
      .insert({
        empleado_id: asignacion.empleado_id,
        organizacion_id: asignacion.empleado!.organizacion_id,
        sede_id: asignacion.sede_id,
        enviado_en: ahora.toISOString(),
        vence_en: venceEn,
        estado: 'pendiente',
      })
      .select()
      .single();

    if (error || !chequeo) continue;

    const { data: suscripciones } = await admin
      .from('push_subscriptions')
      .select('*')
      .eq('empleado_id', asignacion.empleado_id);

    for (const sub of suscripciones ?? []) {
      const resultado = await enviarPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          titulo: 'Confirmá tu ubicación',
          cuerpo: `Tenés ${MINUTOS_VENCIMIENTO} minutos para confirmar que seguís en tu puesto.`,
          chequeoId: chequeo.id,
        }
      );
      if (resultado.expirada) {
        await admin.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }

    enviados += 1;
  }

  return NextResponse.json({ enviados, candidatos: candidatos.size });
}
