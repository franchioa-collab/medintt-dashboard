import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';
import { ROLES_ADMIN_EMPRESA } from '@/lib/presentismo/constants';

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
  if (!ROLES_ADMIN_EMPRESA.includes(sesion.perfil.rol)) {
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
