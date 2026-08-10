import { NextResponse } from 'next/server';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';
import {
  evaluarUbicacionContraSedes,
  esTarde,
  sedesVigentesHoy,
  type AsignacionConSede,
} from '@/lib/presentismo/geo';
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

  const ahora = new Date();

  // Trabajo en campo (Etapa 3): si alguna asignación vigente hoy es
  // flotante, no se evalúa geocerca — se acepta la marcación desde
  // cualquier lugar. La sede de la asignación queda solo como referencia.
  const asignacionFlotante = sedesVigentesHoy(asignaciones, ahora).find(
    ({ asignacion }) => asignacion.es_flotante
  );

  const evaluacion = asignacionFlotante ? null : evaluarUbicacionContraSedes(asignaciones, lat, lon, ahora);

  const horaInicioReferencia = asignacionFlotante?.asignacion.hora_inicio ?? evaluacion?.asignacion.hora_inicio;
  const tarde = tipo === 'ingreso' && horaInicioReferencia ? esTarde(ahora, horaInicioReferencia) : false;

  const resultado: 'dentro_de_zona' | 'fuera_de_zona' | 'sin_geocerca' = asignacionFlotante
    ? 'sin_geocerca'
    : evaluacion?.dentroDeZona
      ? 'dentro_de_zona'
      : 'fuera_de_zona';

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
      sede_id: asignacionFlotante?.sede.id ?? evaluacion?.sede.id ?? null,
      distancia_metros: asignacionFlotante ? null : (evaluacion?.distanciaMetros ?? null),
      resultado,
      tarde,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'error_guardando' }, { status: 500 });
  }

  return NextResponse.json({ marcacion });
}
