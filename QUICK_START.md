# Quick Start - Dashboard Medintt

## Instalación y Setup en 5 minutos

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar Google Cloud (CRÍTICO)

**Si aún no hiciste esto**, sigue `README.md` sección "Setup - Google Cloud Console".

Necesitas:
- Crear Project en Google Cloud
- Habilitar Google Sheets API
- Crear Service Account (genera JSON con credenciales)
- Compartir cada Google Sheet con el email de la Service Account

### 3. Crear `.env.local`

Copia y completa este archivo en la raíz del proyecto:

```env
# Credenciales de Google Cloud (del archivo JSON descargado)
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_CLIENT_EMAIL="medintt-dashboard@tu-proyecto.iam.gserviceaccount.com"
GOOGLE_SHEETS_PROJECT_ID="tu-proyecto-id"

# IDs de los Sheets (extrae de la URL de cada Sheet)
NEXT_PUBLIC_SHEET_PIRE_RAYEN="1y0XZB6fkrdrt2bxkS6bmaxvRkiYCag-Ai3RFDPR_XBg"
NEXT_PUBLIC_SHEET_EL_FORTIN="1JrMKqxkltuM6hSxhu-DZgEXyfZaIMi2jR5ndKbgJ5kQ"
NEXT_PUBLIC_SHEET_MASA_ARGENTINA="15qSmA9eNVkg6ygCmbGsAwM9aH6_mfteYhMZJGxsF2kY"
NEXT_PUBLIC_SHEET_SANOVO_GREENPACK="1K1ECPny2D_as5BLiJgWsVXvW1H7jpd_iLC8hI1peNM4"
NEXT_PUBLIC_SHEET_COOPERATIVA_OBRERA="1qlITSFRD1HJTvQ8GvUcBrumIzKl0V0lSYWKH1incqTc"
NEXT_PUBLIC_SHEET_BRENT_ENERGIA="1AicyJGUEFmvJtZrbS-TmU74NhSQ2PT_mkajjAfBGFFE"
```

### 4. Ejecutar localmente
```bash
npm run dev
```

Abre http://localhost:3000

## Deploy en Vercel

```bash
# 1. Crear repo en GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAME/medintt-dashboard.git
git push -u origin main

# 2. En https://vercel.com
# - Click "New Project"
# - Importa tu repo de GitHub
# - Agrega las mismas variables de .env.local en "Environment Variables"
# - Click "Deploy"
```

Tu dashboard estará en: `https://medintt-dashboard.vercel.app`

## Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| "Error al cargar datos" | Verifica `.env.local` con credenciales correctas |
| "Tarjeta muestra error" | Comprueba que el Sheet está compartido con el email de la SA |
| "Module not found" | Corre `npm install` nuevamente |

**Más detalles en `README.md`**
