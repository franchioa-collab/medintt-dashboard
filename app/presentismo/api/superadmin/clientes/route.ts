import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteAdmin } from '@/lib/presentismo/supabase-server';

interface CuerpoCliente {
  nombreEmpresa?: string;
  nombreAdmin?: string;
  emailAdmin?: string;
}

function generarPasswordTemporal(): string {
  const azar = () => Math.random().toString(36).slice(-4);
  return `${azar()}${azar()}-${azar()}`;
}

export async function POST(request: Request) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  // Solo el dueño de la plataforma da de alta empresas clientes nuevas —
  // un admin de una empresa cliente no debe poder crear otras.
  if (sesion.perfil.rol !== 'super_admin') {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  let body: CuerpoCliente;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'body_invalido' }, { status: 400 });
  }

  const { nombreEmpresa, nombreAdmin, emailAdmin } = body;
  if (!nombreEmpresa || !nombreAdmin || !emailAdmin) {
    return NextResponse.json({ error: 'datos_invalidos' }, { status: 400 });
  }

  const admin = crearClienteAdmin();

  const { data: organizacion, error: errorOrganizacion } = await admin
    .from('organizaciones')
    .insert({ nombre: nombreEmpresa })
    .select()
    .single();

  if (errorOrganizacion || !organizacion) {
    return NextResponse.json({ error: 'error_creando_organizacion' }, { status: 500 });
  }

  const passwordTemporal = generarPasswordTemporal();
  const { data: nuevoUsuario, error: errorCreandoUsuario } = await admin.auth.admin.createUser({
    email: emailAdmin,
    password: passwordTemporal,
    email_confirm: true,
  });

  if (errorCreandoUsuario || !nuevoUsuario?.user) {
    await admin.from('organizaciones').delete().eq('id', organizacion.id);
    const enUso = errorCreandoUsuario?.message?.toLowerCase().includes('already');
    return NextResponse.json({ error: enUso ? 'email_en_uso' : 'error_creando_usuario' }, { status: 400 });
  }

  const { error: errorPerfil } = await admin.from('perfiles').insert({
    id: nuevoUsuario.user.id,
    organizacion_id: organizacion.id,
    nombre_completo: nombreAdmin,
    rol: 'admin',
    activo: true,
  });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(nuevoUsuario.user.id);
    await admin.from('organizaciones').delete().eq('id', organizacion.id);
    return NextResponse.json({ error: 'error_creando_perfil' }, { status: 500 });
  }

  return NextResponse.json({ passwordTemporal, organizacion });
}
