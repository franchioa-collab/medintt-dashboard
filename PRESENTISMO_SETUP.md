# Presentismo — guía de setup (Etapa 1)

Módulo de control de presentismo con geolocalización, dentro del mismo proyecto del
dashboard de Medintt. Vive en `/presentismo` y usa [Supabase](https://supabase.com)
(base de datos + login), separado del resto del dashboard que sigue leyendo de Google
Sheets sin cambios.

## 1. Crear el proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto nuevo (plan gratuito
   alcanza para arrancar).
2. Andá a **SQL Editor** → **New query**, pegá todo el contenido de
   [`supabase/schema.sql`](supabase/schema.sql) y ejecutalo. Esto crea todas las tablas,
   roles y reglas de seguridad (cada empresa cliente solo ve sus propios datos).
3. Andá a **Project Settings → API** y copiá:
   - `Project URL`
   - `anon public` key
   - `service_role` key (¡secreta, nunca la compartas ni la subas a git!)

## 2. Variables de entorno

Copiá `.env.local.example` a `.env.local` y completá:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://TU-PROYECTO.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="tu-anon-key-publica"
SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key-secreta"
```

En Vercel, cargá las mismas variables en **Project Settings → Environment Variables**.

## 3. Dar de alta la primera empresa cliente y su primer admin

El panel solo permite crear empleados **desde una cuenta admin ya existente**, así que la
primera empresa y su primer usuario admin se cargan a mano, una única vez por cliente.
Desde el **SQL Editor** de Supabase:

```sql
-- 1. Crear la organización (empresa cliente)
insert into organizaciones (nombre) values ('Nombre de la empresa cliente')
returning id;
-- Copiá el id que devuelve, lo vas a necesitar abajo.
```

Después, en **Authentication → Users → Add user**, creá el primer usuario (email +
contraseña, con "Auto Confirm User" tildado). Copiá el `UID` que le asigna Supabase.

```sql
-- 2. Convertir a ese usuario en admin de la organización
insert into perfiles (id, organizacion_id, nombre_completo, rol)
values ('UID-DEL-USUARIO', 'ID-DE-LA-ORGANIZACION', 'Nombre y Apellido', 'admin');
```

Con eso ya podés entrar a `/presentismo/login` con ese email y contraseña. Desde el panel
admin (**Empleados**) se puede crear a todos los demás usuarios sin volver a tocar SQL —
al crear un empleado se genera una contraseña temporal que se muestra una sola vez para
compartir con esa persona.

## 4. Cargar sedes y horarios

Como admin, entrá a **Sedes** y cargá al menos un predio (nombre, coordenadas, radio de
tolerancia — el botón "Usar mi ubicación actual" ayuda si estás parado en el lugar). Después,
en **Empleados → (elegir empleado)**, asignale una o varias sedes con sus días y horario.
Un empleado puede tener varias sedes asignadas (su lugar habitual + sedes de clientes que
visite), cada una con su propio horario.

## 5. Probar en el celular

1. Corré `npm install && npm run dev` y abrí `http://localhost:3000/presentismo/login`
   (o la URL de producción una vez desplegado).
2. Iniciá sesión con un usuario empleado.
3. Aceptá la pantalla de consentimiento (una sola vez).
4. Probá "Marcar ingreso" — el navegador va a pedir permiso de ubicación.
5. Desde el celular, podés "Agregar a pantalla de inicio" para instalarla como app
   (funciona en Android y iOS sin pasar por ninguna tienda de aplicaciones).

## Notas

- El ícono de la app (`public/presentismo/icon.svg`) es un placeholder con los colores de
  Medintt — conviene reemplazarlo por el logo real antes de repartir la app a usuarios
  finales.
- Cada organización puede tener su propio logo: basta con cargar una URL en la columna
  `logo_url` de `organizaciones` y aparece automáticamente en el encabezado de sus
  usuarios, sin tocar código.
- Las marcaciones son inmutables: no hay forma de editarlas ni borrarlas desde la app,
  ni siquiera como admin (a propósito, para que el registro sea confiable).
