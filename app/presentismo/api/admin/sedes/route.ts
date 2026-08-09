import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';
import { ROLES_ADMIN_EMPRESA } from '@/lib/presentismo/constants';

interface CuerpoSede {
  nombre?: string;
  latitud?: number;
  longitud?: number;
  radioMetros?: number;
}

export async function POST(request: Request) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  if (!ROLES_ADMIN_EMPRESA.includes(sesion.perfil.rol)) {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  let body: CuerpoSede;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const { nombre, latitud, longitud, radioMetros } = body;
  if (
    !nombre ||
    typeof latitud !== 'number' ||
    typeof longitud !== 'number' ||
    typeof radioMetros !== 'number' ||
    radioMetros < 10
  ) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }

  const supabase = await crearClienteServidor();
  const { data: sede, error } = await supabase
    .from('sedes')
    .insert({
      organizacion_id: sesion.organizacion.id,
      nombre,
      latitud,
      longitud,
      radio_metros: radioMetros,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'error_guardando' }, { status: 500 });
  }

  return NextResponse.json({ sede });
}
