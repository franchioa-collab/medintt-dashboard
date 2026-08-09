import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';

interface CuerpoSuscripcion {
  endpoint?: string;
  p256dh?: string;
  auth?: string;
}

export async function POST(request: Request) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });

  let body: CuerpoSuscripcion;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const { endpoint, p256dh, auth } = body;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ empleado_id: sesion.userId, endpoint, p256dh, auth }, { onConflict: 'endpoint' });

  if (error) {
    return NextResponse.json({ error: 'error_guardando' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
