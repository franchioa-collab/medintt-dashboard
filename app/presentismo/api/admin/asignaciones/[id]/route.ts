import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  if (sesion.perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('empleado_sedes').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'error_eliminando' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
