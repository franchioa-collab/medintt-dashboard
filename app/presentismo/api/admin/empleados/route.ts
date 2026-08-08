import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import type { RolUsuario } from '@/lib/presentismo/database.types';

const ROLES_VALIDOS: RolUsuario[] = ['admin', 'supervisor_sede', 'empleado'];

interface CuerpoEmpleado {
  nombreCompleto?: string;
  email?: string;
  rol?: RolUsuario;
}

function generarPasswordTemporal(): string {
  const azar = () => Math.random().toString(36).slice(-4);
  return `${azar()}${azar()}-${azar()}`;
}

export async function POST(request: Request) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  if (sesion.perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  let body: CuerpoEmpleado;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const { nombreCompleto, email, rol } = body;
  if (!nombreCompleto || !email || !rol || !ROLES_VALIDOS.includes(rol)) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }

  const passwordTemporal = generarPasswordTemporal();
  const admin = crearClienteAdmin();

  const { data: nuevoUsuario, error: errorCreandoUsuario } = await admin.auth.admin.createUser({
    email,
    password: passwordTemporal,
    email_confirm: true,
  });

  if (errorCreandoUsuario || !nuevoUsuario?.user) {
    const enUso = errorCreandoUsuario?.message?.toLowerCase().includes('already');
    return NextResponse.json({ error: enUso ? 'email_en_uso' : 'error_creando_usuario' }, { status: 400 });
  }

  const { error: errorPerfil } = await admin.from('perfiles').insert({
    id: nuevoUsuario.user.id,
    organizacion_id: sesion.organizacion.id,
    nombre_completo: nombreCompleto,
    rol,
    activo: true,
  });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(nuevoUsuario.user.id);
    return NextResponse.json({ error: 'error_creando_perfil' }, { status: 500 });
  }

  return NextResponse.json({ passwordTemporal });
}
