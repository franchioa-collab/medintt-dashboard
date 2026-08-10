import { NextResponse } from 'next/server';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';

export async function POST() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  }

  const { error } = await supabase.rpc('aceptar_consentimiento_campo');
  if (error) {
    return NextResponse.json({ error: 'error_guardando' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
