import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor } from '@/lib/presentismo/supabase-server';

interface CuerpoRespuesta {
  lat?: number;
  lon?: number;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });

  let body: CuerpoRespuesta;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const { lat, lon } = body;
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }

  const supabase = await crearClienteServidor();
  // La función valida que el chequeo sea del usuario logueado y calcula la
  // distancia server-side; no confía en nada más que las coordenadas crudas.
  const { data: chequeo, error } = await supabase.rpc('responder_chequeo', {
    chequeo_id: id,
    lat,
    lon,
  });

  if (error) {
    return NextResponse.json({ error: 'chequeo_no_valido' }, { status: 400 });
  }

  return NextResponse.json({ chequeo });
}
