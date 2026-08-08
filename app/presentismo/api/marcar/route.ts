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
