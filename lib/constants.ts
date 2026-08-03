import type { Mes } from './types';

export const EMPRESAS = {
  pire_rayen: {
    id: 'pire_rayen',
    nombre: 'Pire Rayen',
    sheetId: process.env.NEXT_PUBLIC_SHEET_PIRE_RAYEN || '',
  },
  el_fortin: {
    id: 'el_fortin',
    nombre: 'El Fortín',
    sheetId: process.env.NEXT_PUBLIC_SHEET_EL_FORTIN || '',
  },
  masa_argentina: {
    id: 'masa_argentina',
    nombre: 'Masa Argentina',
    sheetId: process.env.NEXT_PUBLIC_SHEET_MASA_ARGENTINA || '',
  },
  sanovo_greenpack: {
    id: 'sanovo_greenpack',
    nombre: 'Sanovo Greenpack',
    sheetId: process.env.NEXT_PUBLIC_SHEET_SANOVO_GREENPACK || '',
  },
  cooperativa_obrera: {
    id: 'cooperativa_obrera',
    nombre: 'Cooperativa Obrera Ltd',
    sheetId: process.env.NEXT_PUBLIC_SHEET_COOPERATIVA_OBRERA || '',
  },
  brent_energia: {
    id: 'brent_energia',
    nombre: 'Brent Energía y Servicios',
    sheetId: process.env.NEXT_PUBLIC_SHEET_BRENT_ENERGIA || '',
  },
};

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const;

export const FRENTES = [
  '1. Exámenes por riesgo',
  '2. Capacitaciones',
  '3. Auditorías internas',
  '4. Legajos',
  '5. Devolución de hallazgos',
  '6. Gestión y continuidad',
] as const;

export const COLORES_ESTADO = {
  'N/A': 'bg-gray-200 text-gray-800',
  'Pendiente': 'bg-amarillo text-gray-900',
  'En curso': 'bg-blue-400 text-white',
  'Cumplido': 'bg-green-500 text-white',
};

export const COLORES_TIPO = {
  'Obligación legal': 'bg-red-100 text-red-800 border border-red-300',
  'Estándar de certificación': 'bg-blue-100 text-blue-800 border border-blue-300',
  'Buena práctica': 'bg-green-100 text-green-800 border border-green-300',
};

export const getMesActual = (): Mes => {
  const meses = MESES;
  const mesIndex = new Date().getMonth();
  return meses[mesIndex];
};
