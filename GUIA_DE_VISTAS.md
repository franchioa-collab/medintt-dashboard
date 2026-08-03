# Guía de Vistas - Dashboard Medintt

## 1. Vista General (`/`)

**Qué ves:**
- 6 tarjetas (una por empresa cliente)
- Cada tarjeta muestra:
  - Nombre de la empresa
  - % de tareas completadas en el mes actual
  - Semáforo de severidad (🟢 verde / 🟡 amarillo / 🔴 rojo)
  - Contador de obligaciones legales incumplidas

**Semáforo:**
- 🟢 **Verde**: Todas las obligaciones legales del mes están cumplidas
- 🟡 **Amarillo**: 1-2 obligaciones legales incumplidas
- 🔴 **Rojo**: 3 o más obligaciones legales incumplidas

**Controles:**
- Botón "Refrescar" (arriba a la derecha) - actualiza datos bajo demanda
- Click en cualquier tarjeta → va a vista de empresa
- Link "Ver consolidado mensual" → vista consolidada

**Ejemplo:**
```
┌─────────────────────────────────┐
│ Pire Rayen                      │
│                                 │
│ 68%                          ✓  │  (tarjeta verde)
│ 24 de 35 completadas         🟢 │
│                                 │
│ 0 obligaciones incumplidas      │
└─────────────────────────────────┘
```

---

## 2. Vista por Empresa (`/empresa/[id]`)

**Qué ves:**
- Nombre de la empresa (encabezado)
- Selector de mes (dropdown Ene-Dic)
- Filtros por "Frente" (checkboxes)
- Tabla con todas las 35 tareas

**Columnas de la tabla:**
- **N°**: Número de tarea (1-35)
- **Frente**: Categoría (1. Exámenes por riesgo, 2. Capacitaciones, etc.)
- **Tarea**: Nombre/descripción de la tarea
- **Tipo**: Badge (Obligación legal | Estándar de certificación | Buena práctica)
- **Responsable**: Rol responsable (MT, ENF, ADM, etc.)
- **Estado**: Badge de estado

**Estados (con colores):**
- 🔘 **Gris**: N/A (no aplica este mes)
- 🟨 **Amarillo**: Pendiente
- 🔵 **Azul**: En curso
- 🟩 **Verde**: Cumplido

**Cómo usar:**
1. Selecciona un mes en el dropdown
2. Checkea/uncheckea "Frentes" para filtrar
3. Click en una fila → se expande y muestra detalles (Referencia Normativa, Periodicidad, Evidencia, Observaciones)
4. Botón "Volver" (arriba) → regresa a Vista General

**Ejemplo expandido:**
```
┌─────────────────────────────────────────────────────────┐
│ 1  │ 1. Ex... │ Examen médico... │ Obligación legal │ MT │ Cumplido │
│    │ Referencia: Res. SRT 905/15                      │
│    │ Periodicidad: Mensual                             │
│    │ Evidencia: Legajo del empleado                    │
│    │ Colabora: ENF                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Vista Consolidada Mensual (`/mes`)

**Qué ves:**
- Todas las tareas PENDIENTES de las 6 empresas en una sola tabla
- Selector de mes
- Filtros por:
  - Frente (checkboxes)
  - Tipo de tarea (checkboxes)

**La tabla muestra:**
- Empresa
- N° de tarea
- Frente
- Tarea
- Tipo (badge)
- Estado (badge)

**Comportamiento especial:**
- Solo muestra tareas que NO están "Cumplido" ni "N/A"
- Ordena por: Tipo (Obligación legal primero), luego Empresa, luego N°
- Click en empresa → va a `/empresa/[id]?mes=X`

**Ejemplo:**
```
Consolidado Mensual - Agosto (12 pendientes)

Empresa              │ N°  │ Frente              │ Tarea                    │ Tipo                      │ Estado
────────────────────────────────────────────────────────────────────────────────────────────────────────────
Pire Rayen           │ 1   │ 1. Exámenes...      │ Examen médico ocupacional│ Obligación legal          │ Pendiente
El Fortín            │ 3   │ 2. Capacitaciones   │ Capacitación en SyH      │ Obligación legal          │ En curso
Masa Argentina       │ 15  │ 4. Legajos          │ Actualizar legajo        │ Estándar de certificación │ Pendiente
...
```

---

## Navegación Global

Desde cualquier página:
- Logo "Medintt" (encabezado) → va a Vista General
- Botón "Volver" / "←" → regresa a página anterior
- Botón "Refrescar" → actualiza datos

---

## Paleta de Colores

| Componente | Color | Uso |
|------------|-------|-----|
| Encabezados | Navy `#0B2A4A` | Headers, títulos principales |
| Acentos | Celeste `#3FB6D3` | Botones secundarios, links |
| Alerta | Amarillo `#FFC845` | Tareas pendientes, warnings |
| Detalles | Lila `#9B8AC4` | Elementos decorativos |

---

## Datos Actuales

El dashboard automáticamente:
- **Carga datos** al abrir cualquier página
- **Cachea por 5 minutos** (ahorra cuota de Google API)
- Muestra **timestamp** de última actualización en cada página
- Si presionas "Refrescar" 2+ veces en <10s, muestra "Esperando caché..."

---

## Tips de Uso

1. **Mes Actual**: Por defecto muestra el mes actual (Enero = enero, etc.)
2. **Filtros**: Los filtros de Frente se guardan en la sesión (no persisten al recargar)
3. **Mobile**: Diseño responsive - prueba en teléfono también
4. **Expandir Filas**: En Vista por Empresa, click en una fila para ver todos los detalles
5. **Copiar Datos**: Puedes seleccionar y copiar texto de la tabla para pegar en Excel

---

## Ejemplo de Flujo de Uso

```
1. Abres Dashboard (Vista General)
   ↓
2. Ves las 6 tarjetas con estados
   ↓
3. Haces click en "Pire Rayen" (tarjeta roja = hay problemas)
   ↓
4. Ves tabla detallada de sus 35 tareas
   ↓
5. Seleccionas mes "Agosto"
   ↓
6. Filtras por Frente "2. Capacitaciones"
   ↓
7. Ves 2 tareas pendientes de capacitación
   ↓
8. Haces click en una para ver referencia normativa
   ↓
9. Vuelves a Vista General
   ↓
10. Haces click en "Ver consolidado mensual"
   ↓
11. Ves todas las tareas PENDIENTES de las 6 empresas juntas
```

---

**¿Tienes dudas sobre alguna vista? Revisa `README.md` para más detalles técnicos.**
