# Dashboard de Salud Ocupacional - Medintt

Dashboard web para gestión de salud ocupacional de empresas cliente de Medintt. Lee datos en tiempo real desde 6 Google Sheets y los visualiza en un panel interactivo.

## Características

- **Vista General**: 6 tarjetas con estado de salud ocupacional por empresa (% de cumplimiento + semáforo de severidad)
- **Vista por Empresa**: Tabla detallada y filtrable de 35 tareas mensuales por empresa
- **Vista Consolidada Mensual**: Todas las tareas pendientes en un solo lugar, ordenadas por severidad
- **Refresh Manual**: Botón para actualizar datos bajo demanda
- **Responsive**: Diseño mobile-first que funciona en escritorio, tablet y móvil
- **Paleta Medintt**: Colores corporativos (navy, celeste, amarillo, lila)

## Tech Stack

- **Next.js 14+** con App Router
- **TypeScript** para type safety
- **Tailwind CSS** para estilos
- **Google Sheets API v4** para lectura de datos
- **Vercel** para deployment

## Setup - Google Cloud Console

Sigue estos pasos **en orden** para crear la Service Account y compartir los Sheets:

### 1. Crear Proyecto en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Click en la lista desplegable de proyectos (arriba a la izquierda)
3. Click en "NEW PROJECT"
4. Nombre: `MEDINTT Dashboard`
5. Click "CREATE"
6. Espera a que se cree (puede tardar 30 segundos)

### 2. Habilitar Google Sheets API

1. En la consola, busca "Sheets API" en la barra de búsqueda de APIs
2. Selecciona "Google Sheets API"
3. Click "ENABLE"
4. Espera confirme que está habilitado

### 3. Crear Service Account

1. En la consola, ve a **IAM & Admin** → **Service Accounts**
2. Click "CREATE SERVICE ACCOUNT"
3. Nombre: `medintt-dashboard`
4. ID: generado automáticamente (ej: `medintt-dashboard@PROJECT-ID.iam.gserviceaccount.com`)
5. Descripción: `Dashboard de Salud Ocupacional Medintt`
6. Click "CREATE AND CONTINUE"
7. En "Grant this service account access to project":
   - Role: `Viewer` (solo lectura)
   - Click "CONTINUE"
8. Click "DONE"

### 4. Crear y Descargar Clave JSON

1. En **Service Accounts**, haz click en el email de `medintt-dashboard`
2. Ve a pestaña "KEYS"
3. Click "ADD KEY" → "Create new key"
4. Type: "JSON"
5. Click "CREATE"
6. **Se descarga automáticamente** `PROJECT-ID-xxxxx.json`
   - **Guarda este archivo en un lugar seguro** (contiene credenciales)

### 5. Compartir cada Google Sheet

Para cada una de las 6 Sheets en la carpeta "MEDINTT - Tableros de Campo":

1. Abre el Sheet en Google Drive
2. Click "Share" (arriba a la derecha)
3. En el campo "Add people and groups", pega el email de la Service Account:
   ```
   medintt-dashboard@PROJECT-ID.iam.gserviceaccount.com
   ```
   (Reemplaza `PROJECT-ID` con tu ID real de Google Cloud)
4. Role: **Viewer** (solo lectura)
5. Click "Share"
6. No envíes notificaciones (unchecked)

**Repite para las 6 empresas:**
- Pire Rayen
- El Fortín
- Masa Argentina
- Sanovo Greenpack
- Cooperativa Obrera Ltd
- Brent Energía y Servicios

## Setup - Local

### 1. Clonar y Instalar

```bash
git clone <URL-DEL-REPO>
cd medintt-dashboard
npm install
```

### 2. Configurar Variables de Entorno

1. Copia `.env.local.example` a `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Abre el archivo JSON descargado de Google Cloud (`PROJECT-ID-xxxxx.json`)

3. Extrae estos valores y pégalos en `.env.local`:

   **GOOGLE_SHEETS_PRIVATE_KEY**: 
   - Copia la línea `"private_key"` del JSON (el valor completo incluyendo `\n`)
   - En `.env.local`, pégalo como:
     ```
     GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
     ```

   **GOOGLE_SHEETS_CLIENT_EMAIL**:
   - Copia el valor de `"client_email"` del JSON
   - En `.env.local`:
     ```
     GOOGLE_SHEETS_CLIENT_EMAIL="medintt-dashboard@project-id.iam.gserviceaccount.com"
     ```

   **GOOGLE_SHEETS_PROJECT_ID**:
   - Copia el valor de `"project_id"` del JSON
   - En `.env.local`:
     ```
     GOOGLE_SHEETS_PROJECT_ID="your-project-id"
     ```

3. **IDs de los Sheets** (ya están en `.env.local.example`):
   - Los puedes obtener de la URL de cada Sheet: `https://docs.google.com/spreadsheets/d/**ESTE-ID**/edit`
   - Pega en `.env.local`:
     ```
     NEXT_PUBLIC_SHEET_PIRE_RAYEN="1y0XZB6fkrdrt2bxkS6bmaxvRkiYCag-Ai3RFDPR_XBg"
     NEXT_PUBLIC_SHEET_EL_FORTIN="1JrMKqxkltuM6hSxhu-DZgEXyfZaIMi2jR5ndKbgJ5kQ"
     ...
     ```

### 3. Ejecutar Localmente

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### 4. Probar

- **Vista General**: Deberían cargar las 6 tarjetas de empresas
- **Click en tarjeta**: Navega a vista por empresa
- **Filtros**: Prueba filtrar por Frente y mes
- **Refresh**: Button en la esquina arriba a la derecha

## Setup - Deploy en Vercel

### 1. Crear Repositorio en GitHub

```bash
git init
git add .
git commit -m "Initial commit: Medintt dashboard"
git remote add origin https://github.com/USERNAME/medintt-dashboard.git
git push -u origin main
```

### 2. Conectar Vercel

1. Ve a [Vercel.com](https://vercel.com/) y loguéate (o crea cuenta)
2. Click "New Project"
3. Importa el repositorio de GitHub
4. Click "Import"

### 3. Agregar Variables de Entorno en Vercel

1. En los settings del proyecto, ve a **Settings** → **Environment Variables**
2. Agrega cada variable (los mismos valores que en `.env.local`):
   - `GOOGLE_SHEETS_PRIVATE_KEY`
   - `GOOGLE_SHEETS_CLIENT_EMAIL`
   - `GOOGLE_SHEETS_PROJECT_ID`
   - `NEXT_PUBLIC_SHEET_PIRE_RAYEN`
   - `NEXT_PUBLIC_SHEET_EL_FORTIN`
   - `NEXT_PUBLIC_SHEET_MASA_ARGENTINA`
   - `NEXT_PUBLIC_SHEET_SANOVO_GREENPACK`
   - `NEXT_PUBLIC_SHEET_COOPERATIVA_OBRERA`
   - `NEXT_PUBLIC_SHEET_BRENT_ENERGIA`

3. Click "Deploy"

### 4. Acceder a tu Dashboard

Una vez desplegado, Vercel te dará una URL pública:
```
https://medintt-dashboard.vercel.app/
```

Comparte este link con el equipo de Medintt.

## Estructura de Datos

### Estructura del Google Sheet

Cada Sheet tiene esta estructura (fila 4 = encabezados, datos desde fila 5):

```
N° | Frente | Tarea | Referencia normativa | Tipo | Periodicidad | Responsable | Colabora | Evidencia | Ene | Feb | ... | Dic | Observaciones
1  | 1. Ex... | Exam... | Res. SRT 905/15 | Obligación legal | Mensual | MT | ENF | Doc. | Cumplido | ...
```

**Valores permitidos:**
- **Estado (Ene-Dic)**: `Pendiente`, `En curso`, `Cumplido`, `N/A`
- **Tipo**: `Obligación legal`, `Estándar de certificación`, `Buena práctica`
- **Roles**: `MT`, `ENF`, `ADM`, `COORD-HS`, `AUD`, `GER-CLIENTE`

## Troubleshooting

### Error: "Error al cargar datos" al iniciar

**Causa**: Credenciales de Google no configuradas correctamente

**Solución**:
1. Verifica que `.env.local` tiene las 3 variables de Google Cloud
2. Revisa que la `PRIVATE_KEY` tenga los saltos de línea (`\n`) correctos
3. En Vercel, verifica que las variables de entorno están guardadas

### Tarjeta de empresa muestra "Error cargando datos"

**Causa**: El Sheet no está compartido con la Service Account

**Solución**:
1. Abre el Sheet en Google Drive
2. Click "Share"
3. Verifica que el email de la SA esté en la lista de colaboradores
4. Si no está, agrégalo con role "Viewer"

### "Esperando caché..." al hacer refresh múltiples veces

**Comportamiento normal**: El dashboard cachea datos por 5 minutos para no exceder cuota de API. Si haces refresh 2+ veces en 10 segundos, espera un poco antes de intentar de nuevo.

## Logs y Debugging

### Local

```bash
npm run dev
# Verifica la consola del navegador (F12) para errores de fetch
# Verifica la terminal para errores del servidor
```

### Vercel

1. En el dashboard de Vercel, ve a **Deployments**
2. Click en el deployment actual
3. Ve a **Logs** para ver errores en tiempo real

## Próximas Mejoras

- [ ] Edición de tareas desde la app (requiere permisos Editor en Sheets)
- [ ] Login de usuario para ver histórico de cambios
- [ ] Integración con Google Forms para reportes
- [ ] Exportar a PDF/Excel
- [ ] Notificaciones automáticas de tareas vencidas

## Support

Para preguntas sobre setup:
1. Verifica el archivo JSON de Service Account tiene las credenciales correctas
2. Comprueba que los Sheets están compartidos con el email de la SA
3. Revisa los logs en Vercel (Deployments → Logs)

---

**© 2024 Medintt - Consultora de Medicina Laboral**
