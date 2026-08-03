import { Tarea, EstadoTarea, TipoTarea, Frente, Mes, Rol } from './types';
import { MESES, FRENTES } from './constants';

const normalizarEstado = (valor: string): EstadoTarea => {
  if (!valor) return 'N/A';
  const normalizado = valor.trim().toLowerCase();

  if (normalizado === 'pendiente') return 'Pendiente';
  if (normalizado === 'en curso') return 'En curso';
  if (normalizado === 'cumplido') return 'Cumplido';
  if (normalizado === 'n/a') return 'N/A';

  return 'N/A';
};

const normalizarRol = (valor: string): Rol[] => {
  if (!valor) return [];
  return valor.split(',').map((r) => r.trim() as Rol);
};

export function parsearTarea(fila: string[], numeroFila: number): Tarea | null {
  // Verificar que la fila tenga suficientes columnas y que el número no esté vacío
  if (!fila || fila.length < 10 || !fila[0]?.trim()) {
    return null;
  }

  const numero = parseInt(fila[0], 10);
  if (isNaN(numero)) return null;

  const frente = (fila[1]?.trim() || '') as Frente;
  const tarea = fila[2]?.trim() || '';
  const referenciaNormativa = fila[3]?.trim() || '';
  const tipo = (fila[4]?.trim() || '') as TipoTarea;
  const periodicidad = fila[5]?.trim() || '';
  const responsable = normalizarRol(fila[6] || '');
  const colabora = normalizarRol(fila[7] || '');
  const evidencia = fila[8]?.trim() || '';

  const estadosMes: { [key in Mes]?: EstadoTarea } = {};
  for (let i = 0; i < MESES.length; i++) {
    const mes = MESES[i];
    const indiceColumna = 9 + i; // Ene empieza en columna 9 (índice)
    if (indiceColumna < fila.length) {
      estadosMes[mes] = normalizarEstado(fila[indiceColumna] || '');
    } else {
      estadosMes[mes] = 'N/A';
    }
  }

  const observaciones = fila[21]?.trim() || ''; // Observaciones después de Dic (columna 21)

  return {
    numero,
    frente,
    tarea,
    referenciaNormativa,
    tipo,
    periodicidad,
    responsable,
    colabora,
    evidencia,
    estadosMes: estadosMes as { [key in Mes]: EstadoTarea },
    observaciones,
  };
}

export function parsearSheetCompleto(datos: string[][]): Tarea[] {
  const tareas: Tarea[] = [];

  for (let i = 0; i < Math.min(datos.length, 35); i++) {
    const fila = datos[i];
    const tarea = parsearTarea(fila, i);
    if (tarea) {
      tareas.push(tarea);
    }
  }

  return tareas;
}
