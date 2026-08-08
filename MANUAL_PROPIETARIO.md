# Manual del propietario — Presentismo (Medintt)

Guía operativa para vos, como dueño/administrador general del producto. No es para
repartir a clientes — eso está en `MANUAL_ADMIN_CLIENTE` (documento aparte, pensado
para el administrador de cada empresa cliente).

## 1. Cómo está armado, en criollo

- **Una sola aplicación** (este repo) sirve tanto el dashboard original de salud
  ocupacional (`/`) como el módulo de presentismo (`/presentismo`) — son dos productos
  independientes que conviven en el mismo proyecto de Vercel.
- **Supabase** es la base de datos y el sistema de login. Un solo proyecto de Supabase
  atiende a **todas** las empresas clientes al mismo tiempo — cada una es una fila en la
  tabla `organizaciones`, con sus datos completamente aislados del resto (nadie de la
  Empresa A puede ver datos de la Empresa B, ni por error).
- **Vercel** aloja la aplicación y la publica en internet. Cada rama de git que subís
  genera automáticamente una URL de prueba (deployment "Preview"); la rama `main` es la
  que queda pública en producción.

## 2. Dar de alta una empresa cliente nueva

Hoy el alta es manual (así se definió para el arranque del producto). Pasos:

1. **Crear la organización** — en Supabase, SQL Editor:
   ```sql
   insert into organizaciones (nombre) values ('Nombre de la empresa cliente')
   returning id;
   ```
   Guardá el `id` que devuelve.

2. **Crear el primer usuario admin de esa empresa** — en Supabase, Authentication →
   Users → Add user → Create new user. Cargá su email y una contraseña provisoria
   (tildá "Auto Confirm User"). Copiá el `UID` que le asigna Supabase.

3. **Vincular ese usuario como admin de la organización**:
   ```sql
   insert into perfiles (id, organizacion_id, nombre_completo, rol)
   values ('UID-DEL-USUARIO', 'ID-DE-LA-ORGANIZACION', 'Nombre y Apellido', 'admin');
   ```

4. Pasale a esa persona el link de login (`https://TU-DOMINIO/presentismo/login`), su
   email y la contraseña provisoria. Desde ahí, ella ya puede manejar todo sola: cargar
   sedes, dar de alta a sus empleados, etc. — ver `MANUAL_ADMIN_CLIENTE`.

No hace falta tocar código ni volver a desplegar nada para dar de alta una empresa
nueva — es 100% datos.

## 3. Dónde vive cada cosa (accesos)

| Qué | Dónde | Para qué entrás ahí |
|---|---|---|
| Base de datos y usuarios | [supabase.com/dashboard](https://supabase.com/dashboard) → proyecto del presentismo | Alta de empresas, resetear contraseñas, ver tablas, revisar logs de errores del servidor |
| Hosting y dominios | [vercel.com/dashboard](https://vercel.com/dashboard) → proyecto `medintt-dashboard` | Ver deploys, variables de entorno, logs en vivo, dominios |
| Código fuente | GitHub, repo `franchioa-collab/medintt-dashboard` | Historial de cambios, ramas |

## 4. Tareas frecuentes

### Resetear la contraseña de un usuario que se la olvidó
Supabase → Authentication → Users → buscar el email → clic en el usuario → menú de
opciones → reset/enviar recuperación (o fijarle una nueva desde ahí mismo). No hace
falta tocar la base de datos a mano para esto.

### Un cliente dice que no puede entrar
Revisá en este orden:
1. ¿El usuario existe en Authentication → Users con ese email?
2. ¿Tiene una fila en la tabla `perfiles` con `activo = true`?
3. ¿Esa fila apunta a la `organizacion_id` correcta?
4. Si todo eso está bien y sigue sin poder entrar, revisá los logs de Vercel
   (Deployments → el deploy activo → Logs) buscando errores en el momento en que
   probó entrar.

### Publicar un cambio nuevo (deploy)
- Cambios chicos: se suben a la rama correspondiente y Vercel despliega solo.
- Pasar algo a producción real: mergear la rama a `main` (por Pull Request en GitHub)
  — Vercel redespliega producción automáticamente al mergear.

### Variables de entorno
Viven en Vercel (Project Settings → Environment Variables) y en tu `.env.local` para
desarrollo local. Si rotás una clave de Supabase, hay que actualizarla en los dos
lugares y volver a desplegar (las variables `NEXT_PUBLIC_*` quedan "horneadas" en el
build, así que un cambio de variable sola no alcanza, hace falta redeploy).

## 5. Privacidad y cumplimiento (Ley 25.326)

- Las marcaciones son inmutables por diseño: nadie —ni siquiera vos con acceso admin
  de Supabase, salvo que uses la consola SQL directamente— puede editarlas ni borrarlas
  desde la app.
- No se guarda un historial continuo de posición, solo los eventos de marcado.
- Si algún cliente pide dar de baja sus datos (derecho de supresión), se hace borrando
  su fila de `organizaciones` (con `on delete cascade` se lleva puestos perfiles, sedes,
  asignaciones y marcaciones de esa empresa — es irreversible, pedí confirmación por
  escrito antes de hacerlo).

## 6. Qué falta (roadmap)

Según el plan original en 3 etapas:

- **Etapa 1 (hecha)**: marcado manual con geovalidación, consentimiento, sedes y
  horarios multi-sede, roles, historial propio.
- **Etapa 2 (pendiente)**: monitoreo periódico durante la jornada (estado
  dentro/fuera en tiempo real, sin tracking continuo).
- **Etapa 3 (pendiente)**: vista de presentismo por día con estados (a horario /
  tarde / fuera de zona / ausente) y exportación CSV/Excel para nómina.

## 7. Soporte de la infraestructura

- Supabase (plan Free): límites generosos para arrancar, pero mirá el uso en
  Project Settings → Usage si la cantidad de clientes crece mucho — puede hacer falta
  pasar a un plan pago.
- Vercel (plan Hobby): pensado para proyectos personales/de bajo tráfico. Si esto se
  vuelve un producto comercial con varios clientes activos, conviene evaluar el plan
  Pro (mejor soporte, sin las limitaciones de uso comercial del plan gratuito).
