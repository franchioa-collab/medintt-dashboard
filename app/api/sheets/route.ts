import { NextResponse } from 'next/server';
import { getAllSheetsData } from '@/lib/googleSheets';
import { parsearSheetCompleto } from '@/lib/parsers';
import { EMPRESAS } from '@/lib/constants';
import type { DatosDashboard } from '@/lib/types';

export const revalidate = 300; // 5 minutos

export async function GET() {
  try {
    // Preparar IDs de sheets
    const sheetIds = Object.entries(EMPRESAS).reduce(
      (acc, [id, empresa]) => ({
        ...acc,
        [id]: empresa.sheetId,
      }),
      {}
    );

    // Obtener datos de todas las sheets
    const { results, errors } = await getAllSheetsData(sheetIds);

    // Procesar datos
    const empresas = Object.entries(EMPRESAS).map(([id, empresa]) => {
      if (errors[id]) {
        return {
          id: empresa.id,
          nombre: empresa.nombre,
          tareas: [],
          error: errors[id],
        };
      }

      const datos = results[id] || [];
      const tareas = parsearSheetCompleto(datos);

      return {
        id: empresa.id,
        nombre: empresa.nombre,
        tareas,
      };
    });

    const response: DatosDashboard = {
      empresas,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error en /api/sheets:', error);
    return NextResponse.json(
      { error: 'Error al cargar datos de las sheets' },
      { status: 500 }
    );
  }
}
