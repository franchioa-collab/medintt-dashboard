import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';

/** Por ahora solo permite asignar/quitar el supervisor de la sede. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  if (sesion.perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  let body: { supervisorId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('sedes')
    .update({ supervisor_id: body.supervisorId ?? null })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'error_guardando' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
