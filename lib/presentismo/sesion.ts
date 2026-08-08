import { cache } from 'react';
import { crearClienteServidor } from './supabase-server';
import type { Organizacion, Perfil } from './database.types';

export interface SesionActual {
  userId: string;
  email: string | undefined;
  perfil: Perfil;
  organizacion: Organizacion;
}

/**
 * Trae el usuario logueado junto con su perfil y organización. null si no hay
 * sesión válida. Envuelta en `cache()` para que layout y page (que corren en
 * el mismo render) no dupliquen las consultas a Supabase.
 */
export const obtenerSesionActual = cache(async (): Promise<SesionActual | null> => {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (!perfil || !perfil.activo) return null;

  const { data: organizacion } = await supabase
    .from('organizaciones')
    .select('*')
    .eq('id', perfil.organizacion_id)
    .single();
  if (!organizacion) return null;

  return { userId: user.id, email: user.email, perfil, organizacion };
});
