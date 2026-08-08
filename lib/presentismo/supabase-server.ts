import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Nota: no se usa el generic <Database> de supabase-js acá; el tipado de
// filas se resuelve con los tipos de database.types.ts al leer los datos
// (ver los `as Perfil[]`, etc. en las páginas), para no pelear con la forma
// exacta que supabase-js espera del generic Database.

/** Cliente para Server Components / Route Handlers, con la sesión del usuario logueado. */
export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // set() puede fallar si se llama desde un Server Component; el
            // middleware ya se encarga de refrescar la sesión en ese caso.
          }
        },
      },
    }
  );
}

/**
 * Cliente administrativo con la service role key: ignora RLS.
 * Usar SOLO en Route Handlers server-side, y siempre después de verificar
 * que quien hace la llamada tiene rol 'admin' en su propia organización.
 */
export function crearClienteAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
