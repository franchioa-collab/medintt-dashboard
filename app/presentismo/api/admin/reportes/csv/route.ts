import { NextResponse } from 'next/server';
import { obtenerSesionActual } from '@/lib/presentismo/sesion';
import { crearClienteServidor, crearClienteAdmin } from '@/lib/presentismo/supabase-server';
import { ROLES_ADMIN_EMPRESA } from '@/lib/presentismo/constants';
import { fechaLocalYMD } from '@/lib/presentismo/fecha';
import { obtenerFilasReporte, textoEstado } from '@/lib/presentismo/reportes';

function formatearHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

function celdaCsv(valor: string) {
  return `"${valor.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const sesion = await obtenerSesionActual();
  if (!sesion) return NextResponse.json({ error: 'no_autenticado' }, { status: 401 });
  if (!ROLES_ADMIN_EMPRESA.includes(sesion.perfil.rol) && sesion.perfil.rol !== 'supervisor_sede') {
    return NextResponse.json({ error: 'no_autorizado' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fecha = searchParams.get('fecha') ?? fechaLocalYMD();
  const fechaDate = new Date(`${fecha}T12:00:00-03:00`);

  const supabase = await crearClienteServidor();
  const filas = await obtenerFilasReporte(supabase, fechaDate);

  const admin = crearClienteAdmin();
  const empleadoIds = filas.map((f) => f.empleadoId);
  const { data: perfilesData } = await admin
    .from('perfiles')
    .select('id, nombre_completo')
    .in('id', empleadoIds.length > 0 ? empleadoIds : ['']);
  const nombrePorEmpleadoId = new Map((perfilesData ?? []).map((p) => [p.id, p.nombre_completo]));

  const filasOrdenadas = [...filas].sort((a, b) =>
    (nombrePorEmpleadoId.get(a.empleadoId) ?? '').localeCompare(nombrePorEmpleadoId.get(b.empleadoId) ?? '')
  );

  const encabezado = ['Empleado', 'Sede', 'Ingreso', 'Egreso', 'Estado', 'Tarde'];
  const filasCsv = filasOrdenadas.map((f) => [
    nombrePorEmpleadoId.get(f.empleadoId) ?? 'Empleado',
    f.sedeNombre,
    f.horaIngreso ? formatearHora(f.horaIngreso) : '',
    f.horaEgreso ? formatearHora(f.horaEgreso) : '',
    textoEstado(f),
    f.tarde ? 'Sí' : 'No',
  ]);

  const lineas = [encabezado, ...filasCsv].map((fila) => fila.map(celdaCsv).join(';'));
  // BOM UTF-8 para que Excel reconozca los acentos sin configuración extra.
  const csv = '﻿' + lineas.join('\r\n') + '\r\n';

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="presentismo_${fecha}.csv"`,
    },
  });
}
