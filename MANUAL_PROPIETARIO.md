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

Ya no hace falta tocar Supabase ni escribir SQL para esto — hay una pantalla dedicada,
exclusiva para tu usuario (rol `super_admin`):

1. Entrá con tu usuario en `https://medintt-dashboard-pi.vercel.app/presentismo/login`.
   En el menú vas a ver una opción que no le aparece a nadie más: **"Empresas
   clientes"**.
2. Completá el formulario: nombre de la empresa, y nombre + email de la persona que va
   a ser su primer administrador.
3. Tocá **"Crear empresa cliente"**. La app crea sola la empresa, crea el usuario, los
   vincula, y te muestra una contraseña provisoria **una única vez** — copiala antes de
   salir de la pantalla, no queda guardada en ningún lado para volver a verla.
4. Pasale a esa persona el link de login, su email y esa contraseña provisoria. Desde
   ahí, ella ya puede manejar todo sola: cargar sedes, dar de alta a sus empleados, etc.
   — ver el manual del administrador de cuenta.

Nadie más que vos ve esta pantalla ni puede crear empresas nuevas — ni siquiera un
`admin` de una empresa cliente, por más permisos que tenga dentro de la suya.

### Si alguna vez necesitás hacerlo a mano igual

Por si la pantalla no está disponible por algún motivo, el proceso manual en Supabase
sigue funcionando igual que antes:

```sql
insert into organizaciones (nombre) values ('Nombre de la empresa cliente')
returning id;
```
Después, Authentication → Users → Add user (con "Auto Confirm User" tildado), copiás el
UID, y:
```sql
insert into perfiles (id, organizacion_id, nombre_completo, rol)
values ('UID-DEL-USUARIO', 'ID-DE-LA-ORGANIZACION', 'Nombre y Apellido', 'admin');
```

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
- No se guarda un historial continuo de posición, solo los eventos de marcado —
  excepto para empleados marcados como "trabajo en campo" (Etapa 3), a quienes
  sí se les registra un punto por cada chequeo periódico durante su horario
  laboral asignado, nunca fuera de ese horario, y solo después de que acepten
  un consentimiento específico que se lo explica.
- Si algún cliente pide dar de baja sus datos (derecho de supresión), se hace borrando
  su fila de `organizaciones` (con `on delete cascade` se lleva puestos perfiles, sedes,
  asignaciones y marcaciones de esa empresa — es irreversible, pedí confirmación por
  escrito antes de hacerlo).

## 6. Qué falta (roadmap)

Según el plan original en 3 etapas:

- **Etapa 1 (hecha)**: marcado manual con geovalidación, consentimiento, sedes y
  horarios multi-sede, roles, historial propio.
- **Etapa 2 (hecha)**: chequeos periódicos durante la jornada. Mientras un empleado
  está "en curso" (marcó ingreso, todavía no marcó egreso) y dentro de su horario
  asignado, cada 1 hora le llega una notificación push pidiéndole confirmar su
  ubicación; tiene 10 minutos para responder desde la app (no hace falta tenerla
  abierta, el aviso llega igual con el teléfono bloqueado, siempre que la app esté
  instalada — ver sección 4 del manual de PWA). Si confirma estando dentro del radio
  de la sede, no se guarda nada. Si confirma estando fuera, o si no responde a
  tiempo, queda una alerta visible en "Presentismo del equipo" para el admin/supervisor,
  y solo en ese caso se guarda la coordenada. El disparador horario corre gratis en la
  base de Supabase (`pg_cron`, ver `supabase/schema.sql`), no en Vercel.
- **Etapa 3 (hecha)**: dos cosas.
  - **Reportes**: pantalla nueva ("Reportes" en el menú) con selector de fecha,
    el estado de cada empleado ese día (a horario / tarde / fuera de zona /
    campo / ausente) y un botón para descargar un CSV listo para nómina.
  - **Trabajo en campo (sede flotante)**: al crear una asignación se puede
    marcar "Trabajo en campo" — el empleado deja de tener geocerca (marca
    ingreso/egreso desde cualquier lado) y los chequeos periódicos de la
    Etapa 2 le guardan la ubicación siempre, no solo si se aleja, armando el
    recorrido del día (visible desde "Reportes"). Como esto es más sensible
    que el esquema dentro/fuera general, al empleado se le pide un
    consentimiento aparte, específico para el recorrido, antes de dejarlo
    volver a marcar.

## 7. Soporte de la infraestructura

- Supabase (plan Free): límites generosos para arrancar, pero mirá el uso en
  Project Settings → Usage si la cantidad de clientes crece mucho — puede hacer falta
  pasar a un plan pago.
- Vercel (plan Hobby): pensado para proyectos personales/de bajo tráfico. Si esto se
  vuelve un producto comercial con varios clientes activos, conviene evaluar el plan
  Pro (mejor soporte, sin las limitaciones de uso comercial del plan gratuito).

## 8. Poner el logo de una empresa cliente

Cada empresa cliente puede tener su propio logo en el encabezado de la app (en vez de
la marca Medintt). Hoy esto se carga a mano, empresa por empresa — no hay todavía un
botón para que el propio cliente lo suba solo (podría construirse más adelante si hace
falta).

1. **Conseguí una URL pública de la imagen.** La forma más simple: en Supabase →
   **Storage**, creá (una sola vez) un bucket público llamado, por ejemplo, `logos`.
   Subís el archivo del cliente ahí (botón "Upload file") y copiás la **URL pública**
   que te da Supabase para ese archivo.
   - Formato recomendado: PNG o SVG, de fondo transparente, más o menos cuadrado
     (funciona mejor visualmente — se muestra chico, como un ícono, sobre fondo azul
     oscuro).
2. **Guardá esa URL en la organización correspondiente** — en el SQL Editor de
   Supabase:
   ```sql
   update organizaciones
   set logo_url = 'https://LA-URL-QUE-COPIASTE.png'
   where id = 'ID-DE-LA-ORGANIZACION';
   ```
   (Si no tenés a mano el `id` de esa organización, `select id, nombre from
   organizaciones;` te lo muestra.)
3. Listo — no hace falta redeploy ni tocar código. La próxima vez que alguien de esa
   empresa entre a la app, ya va a ver su logo en el encabezado en lugar del nombre
   "Medintt · Presentismo".

Para sacarle el logo a una empresa (volver a la marca Medintt), el mismo `update` pero
con `logo_url = null`.

## 9. Vender el presentismo como producto aparte (dominio propio)

Hoy el presentismo vive en el mismo dominio que el dashboard de salud ocupacional
(`medintt-dashboard-pi.vercel.app/presentismo`). Eso está bien mientras es un módulo
interno de Medintt, pero si en algún momento querés venderlo como un producto
independiente — con su propia marca y dirección, sin ningún rastro del dashboard de
salud ocupacional — hace falta armar esto:

1. **Conseguir un dominio.** Puede ser uno nuevo que compres (ej. `mipresentismo.com`)
   o un subdominio de uno que ya tengas (ej. `presentismo.medintt.com`). También es
   posible arrancar gratis con un segundo dominio `.vercel.app`, ver paso 2.

2. **Crear un segundo proyecto en Vercel**, apuntando al mismo repositorio de GitHub y
   a la misma rama `main` (Vercel permite tener más de un proyecto sobre el mismo
   repo). Este proyecto nuevo va a tener su propio dominio — gratis te da uno del tipo
   `nombre-que-elijas.vercel.app`; si comprás uno propio, se lo conectás desde
   Project Settings → Domains, igual que hicimos con este.

3. **Cargar las mismas variables de entorno de Supabase** en ese proyecto nuevo
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`) — sigue siendo la misma base de datos, solo cambia
   dónde se aloja el sitio.

4. **Un ajuste de código (uno solo, chico) para que ese dominio nuevo muestre
   directamente el presentismo** y no el dashboard de salud ocupacional en la portada.
   Sin este paso, en el dominio nuevo también quedaría visible el dashboard en `/`
   (mismo código, las dos partes conviven). La solución es un redirect en
   `middleware.ts` que, cuando la visita venga del dominio nuevo, mande automáticamente
   la portada (`/`) a `/presentismo`. Es cuestión de unas pocas líneas — avisame cuando
   llegue este momento y lo armamos.

5. Con eso, el dominio nuevo queda funcionando como un producto separado — mismos
   datos y mismo código por debajo, pero de cara al cliente no hay ninguna mención al
   dashboard de salud ocupacional ni a Medintt más allá de lo que vos decidas mostrar.

**Nota sobre costos**: un segundo proyecto en Vercel no tiene costo extra en el plan
gratuito (Hobby) siempre que el uso sea bajo — el límite es de tráfico/uso, no de
cantidad de proyectos. Un dominio propio si lo comprás tiene un costo anual aparte
(normalmente entre USD 10 y 20 por año, según el dominio).
