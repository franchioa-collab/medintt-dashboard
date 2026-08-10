import { crearClienteAdmin } from './supabase-server';
import type { RolUsuario } from './database.types';

// A propósito sin 'super_admin' acá: un admin de empresa cliente nunca debe
// poder crear otro super_admin (sería escalar privilegios a nivel plataforma).
export const ROLES_VALIDOS_NUEVO_EMPLEADO: RolUsuario[] = ['admin', 'supervisor_sede', 'empleado'];

function generarPasswordTemporal(): string {
  const azar = () => Math.random().toString(36).slice(-4);
  return `${azar()}${azar()}-${azar()}`;
}

export interface DatosNuevoEmpleado {
  nombreCompleto: string;
  email: string;
  rol: RolUsuario;
}

export type ResultadoCrearEmpleado =
  | { ok: true; passwordTemporal: string }
  | { ok: false; error: 'email_en_uso' | 'error_creando_usuario' | 'error_creando_perfil' };

/**
 * Crea el usuario de auth y su perfil para un empleado nuevo. Usada tanto
 * por el alta individual como por la carga masiva — mismo camino, mismas
 * reglas (rollback del usuario de auth si falla el perfil).
 */
export async function crearEmpleado(
  organizacionId: string,
  datos: DatosNuevoEmpleado,
  admin: ReturnType<typeof crearClienteAdmin> = crearClienteAdmin()
): Promise<ResultadoCrearEmpleado> {
  const passwordTemporal = generarPasswordTemporal();

  const { data: nuevoUsuario, error: errorCreandoUsuario } = await admin.auth.admin.createUser({
    email: datos.email,
    password: passwordTemporal,
    email_confirm: true,
  });

  if (errorCreandoUsuario || !nuevoUsuario?.user) {
    const enUso = errorCreandoUsuario?.message?.toLowerCase().includes('already');
    return { ok: false, error: enUso ? 'email_en_uso' : 'error_creando_usuario' };
  }

  const { error: errorPerfil } = await admin.from('perfiles').insert({
    id: nuevoUsuario.user.id,
    organizacion_id: organizacionId,
    nombre_completo: datos.nombreCompleto,
    rol: datos.rol,
    activo: true,
  });

  if (errorPerfil) {
    await admin.auth.admin.deleteUser(nuevoUsuario.user.id);
    return { ok: false, error: 'error_creando_perfil' };
  }

  return { ok: true, passwordTemporal };
}
