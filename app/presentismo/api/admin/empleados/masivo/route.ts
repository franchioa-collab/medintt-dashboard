import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import { ROLES_ADMIN_EMPRESA } from '@/lib/presentismo/constants';
import { crearEmpleado, ROLES_VALIDOS_NUEVO_EMPLEADO } from '@/lib/presentismo/empleados';
import type { RolUsuario } from '@/lib/presentismo/database.types';

export const maxDuration = 60;

// Tope por tanda: cada alta hace dos viajes a Supabase (usuario + perfil) de
// forma secuencial, así que una tanda muy grande puede pasarse del límite de
// duración de la función serverless. Para bases más grandes, dividir el CSV
// en varios archivos.
const MAX_FILAS = 200;

interface FilaEntrada {
  nombreCompleto?: string;
  email?: string;
  rol?: string;
}

interface ResultadoFila {
  email: string;
  ok: boolean;
  passwordTemporal?: string;
  error?: string;
}

export async function POST(request: Request) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  if (!ROLES_ADMIN_EMPRESA.includes(sesion.perfil.rol)) {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  let body: { filas?: FilaEntrada[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const filas = body.filas;
  if (!Array.isArray(filas) || filas.length === 0) {
    return NextResponse.json({ error: 'sin_filas' }, { status: 400 });
  }
  if (filas.length > MAX_FILAS) {
    return NextResponse.json({ error: 'demasiadas_filas', maximo: MAX_FILAS }, { status: 400 });
  }

  const admin = crearClienteAdmin();
  const resultados: ResultadoFila[] = [];

  for (const fila of filas) {
    const nombreCompleto = fila.nombreCompleto?.trim();
    const email = fila.email?.trim().toLowerCase();
    const rol = (fila.rol?.trim() || 'empleado') as RolUsuario;

    if (!nombreCompleto || !email) {
      resultados.push({ email: email ?? '', ok: false, error: 'faltan_datos' });
      continue;
    }
    if (!ROLES_VALIDOS_NUEVO_EMPLEADO.includes(rol)) {
      resultados.push({ email, ok: false, error: 'rol_invalido' });
      continue;
    }

    // Secuencial a propósito: evita saturar la API de auth de Supabase con
    // decenas de altas en paralelo y mantiene simple el rollback por fila.
    const resultado = await crearEmpleado(sesion.organizacion.id, { nombreCompleto, email, rol }, admin);

    resultados.push(
      resultado.ok
        ? { email, ok: true, passwordTemporal: resultado.passwordTemporal }
        : { email, ok: false, error: resultado.error }
    );
  }

  return NextResponse.json({ resultados });
}
