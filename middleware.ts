import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const esRutaPublica = pathname === '/presentismo/login';
  // Las rutas de API hacen su propia verificación de sesión y devuelven JSON;
  // no deben redirigirse a la pantalla de login.
  const esApi = pathname.startsWith('/presentismo/api/');

  if (!user && !esApi && pathname.startsWith('/presentismo') && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/presentismo/login';
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (user && esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = '/presentismo';
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}

export const config = {
  // Excluye el manifest y el ícono de la PWA (deben poder pedirse sin sesión)
  // y las rutas de API (manejan su propia autenticación y devuelven JSON).
  matcher: ['/presentismo', '/presentismo/((?!manifest\\.webmanifest|icon\\.svg).*)'],
};
