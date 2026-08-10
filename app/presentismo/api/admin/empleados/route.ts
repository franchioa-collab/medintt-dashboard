import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { ROLES_ADMIN_EMPRESA } from '@/lib/presentismo/constants';
import { crearEmpleado, ROLES_VALIDOS_NUEVO_EMPLEADO } from '@/lib/presentismo/empleados';
import type { RolUsuario } from '@/lib/presentismo/database.types';

interface CuerpoEmpleado {
  nombreCompleto?: string;
  email?: string;
  rol?: RolUsuario;
}

export async function POST(request: Request) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  if (!ROLES_ADMIN_EMPRESA.includes(sesion.perfil.rol)) {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  let body: CuerpoEmpleado;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const { nombreCompleto, email, rol } = body;
  if (!nombreCompleto || !email || !rol || !ROLES_VALIDOS_NUEVO_EMPLEADO.includes(rol)) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }

  const resultado = await crearEmpleado(sesion.organizacion.id, { nombreCompleto, email, rol });

  if (!resultado.ok) {
    const status = resultado.error === 'email_en_uso' ? 400 : 500;
    return NextResponse.json({ error: resultado.error }, { status });
  }

  return NextResponse.json({ passwordTemporal: resultado.passwordTemporal });
}
