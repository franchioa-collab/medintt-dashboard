'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RolUsuario } from '@/lib/presentismo/database.types';

const ALIAS_NOMBRE = ['nombre', 'nombrecompleto', 'nombreyapellido', 'empleado'];
const ALIAS_EMAIL = ['email', 'correo', 'mail', 'correoelectronico'];
const ALIAS_ROL = ['rol', 'role', 'perfil'];

const ETIQUETAS_ROL: Record<string, RolUsuario> = {
  empleado: 'empleado',
  supervisor: 'supervisor_sede',
  supervisorsede: 'supervisor_sede',
  supervisordesede: 'supervisor_sede',
  admin: 'admin',
  administrador: 'admin',
};

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizarEncabezado(texto: string) {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]/g, '');
}

/** Parser CSV mínimo: soporta comillas y campos con comas/punto y coma adentro. */
function parsearCsv(texto: string, separador: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === separador) {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else {
      campo += c;
    }
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((c) => c.trim() !== ''));
}

interface FilaPrevia {
  nombreCompleto: string;
  email: string;
  rol: RolUsuario;
  error: string | null;
}

interface ResultadoFila {
  email: string;
  ok: boolean;
  passwordTemporal?: string;
  error?: string;
}

const MENSAJES_ERROR: Record<string, string> = {
  faltan_datos: 'Faltan datos',
  rol_invalido: 'Rol inválido',
  email_en_uso: 'Email ya registrado',
  error_creando_usuario: 'No se pudo crear el usuario',
  error_creando_perfil: 'No se pudo crear el perfil',
};

function celda(valor: string) {
  return `"${valor.replace(/"/g, '""')}"`;
}

function descargarTexto(nombreArchivo: string, contenido: string) {
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CargaMasivaEmpleados() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<FilaPrevia[]>([]);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoFila[] | null>(null);

  function descargarPlantilla() {
    descargarTexto(
      'plantilla_empleados.csv',
      'nombre_completo,email,rol\r\nAna García,ana.garcia@empresa.com,empleado\r\nJuan Pérez,juan.perez@empresa.com,supervisor_sede\r\n'
    );
  }

  function manejarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setErrorArchivo(null);
    setResultados(null);

    const lector = new FileReader();
    lector.onload = () => {
      const texto = String(lector.result ?? '');
      const primeraLinea = texto.split(/\r?\n/, 1)[0] ?? '';
      const separador = (primeraLinea.match(/;/g)?.length ?? 0) > (primeraLinea.match(/,/g)?.length ?? 0) ? ';' : ',';
      const filasCsv = parsearCsv(texto, separador);

      if (filasCsv.length < 2) {
        setErrorArchivo('El archivo no tiene filas de datos.');
        return;
      }

      const encabezados = filasCsv[0].map(normalizarEncabezado);
      const idxNombre = encabezados.findIndex((h) => ALIAS_NOMBRE.includes(h));
      const idxEmail = encabezados.findIndex((h) => ALIAS_EMAIL.includes(h));
      const idxRol = encabezados.findIndex((h) => ALIAS_ROL.includes(h));

      if (idxNombre === -1 || idxEmail === -1) {
        setErrorArchivo(
          'No encontramos las columnas de nombre y email. Descargá la plantilla para ver el formato esperado.'
        );
        return;
      }

      const emailsVistos = new Set<string>();
      const filasParseadas: FilaPrevia[] = filasCsv.slice(1).map((fila) => {
        const nombreCompleto = (fila[idxNombre] ?? '').trim();
        const email = (fila[idxEmail] ?? '').trim().toLowerCase();
        const rolCrudo = idxRol >= 0 ? normalizarEncabezado(fila[idxRol] ?? '') : '';
        const rol = (rolCrudo ? ETIQUETAS_ROL[rolCrudo] : 'empleado') ?? null;

        let error: string | null = null;
        if (!nombreCompleto) error = 'Falta el nombre';
        else if (!email) error = 'Falta el email';
        else if (!REGEX_EMAIL.test(email)) error = 'Email inválido';
        else if (rolCrudo && !rol) error = 'Rol no reconocido';
        else if (emailsVistos.has(email)) error = 'Email duplicado en el archivo';

        if (!error) emailsVistos.add(email);

        return { nombreCompleto, email, rol: rol ?? 'empleado', error };
      });

      setFilas(filasParseadas);
    };
    lector.readAsText(archivo, 'utf-8');
  }

  async function crearEmpleados() {
    const validas = filas.filter((f) => !f.error);
    if (validas.length === 0) return;

    setEnviando(true);
    const res = await fetch('/presentismo/api/admin/empleados/masivo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filas: validas.map((f) => ({ nombreCompleto: f.nombreCompleto, email: f.email, rol: f.rol })),
      }),
    });
    setEnviando(false);

    if (!res.ok) {
      setErrorArchivo('No pudimos procesar la carga. Probá de nuevo o con un archivo más chico.');
      return;
    }

    const { resultados: nuevosResultados } = await res.json();
    setResultados(nuevosResultados);
    router.refresh();
  }

  function descargarResultados() {
    if (!resultados) return;
    const encabezado = ['Nombre', 'Email', 'Estado', 'Contraseña temporal'];
    const nombrePorEmail = new Map(filas.map((f) => [f.email, f.nombreCompleto]));
    const lineas = [
      encabezado,
      ...resultados.map((r) => [
        nombrePorEmail.get(r.email) ?? '',
        r.email,
        r.ok ? 'Creado' : (MENSAJES_ERROR[r.error ?? ''] ?? 'Error'),
        r.passwordTemporal ?? '',
      ]),
    ].map((f) => f.map(celda).join(';'));
    descargarTexto('empleados_creados.csv', lineas.join('\r\n') + '\r\n');
  }

  function reiniciar() {
    setFilas([]);
    setResultados(null);
    setErrorArchivo(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="text-sm text-celeste underline"
      >
        Carga masiva por CSV
      </button>
    );
  }

  const validas = filas.filter((f) => !f.error);
  const invalidas = filas.filter((f) => f.error);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-700">Carga masiva por CSV</h2>
        <button onClick={() => { setAbierto(false); reiniciar(); }} className="text-xs text-gray-500 underline">
          Cerrar
        </button>
      </div>

      <p className="text-sm text-gray-600">
        Subí un CSV con las columnas <span className="font-mono">nombre_completo</span>,{' '}
        <span className="font-mono">email</span> y opcionalmente{' '}
        <span className="font-mono">rol</span> (empleado / supervisor_sede / admin — si se omite,
        queda como empleado).{' '}
        <button onClick={descargarPlantilla} className="text-celeste underline">
          Descargar plantilla
        </button>
      </p>

      {!resultados && (
        <>
          <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={manejarArchivo} className="text-sm" />

          {errorArchivo && <p className="text-sm text-red-600">{errorArchivo}</p>}

          {filas.length > 0 && (
            <>
              <p className="text-sm text-gray-700">
                {validas.length} fila{validas.length === 1 ? '' : 's'} lista
                {validas.length === 1 ? '' : 's'} para crear
                {invalidas.length > 0 && `, ${invalidas.length} con error (no se van a crear)`}.
              </p>

              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
                {filas.map((f, i) => (
                  <div key={i} className="px-3 py-2 flex items-center justify-between text-xs gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{f.nombreCompleto || '(sin nombre)'}</p>
                      <p className="text-gray-500 truncate">{f.email || '(sin email)'}</p>
                    </div>
                    <span className={f.error ? 'text-red-600 shrink-0' : 'text-green-700 shrink-0'}>
                      {f.error ?? 'OK'}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={crearEmpleados}
                disabled={enviando || validas.length === 0}
                className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {enviando ? 'Creando…' : `Crear ${validas.length} empleado${validas.length === 1 ? '' : 's'}`}
              </button>
            </>
          )}
        </>
      )}

      {resultados && (
        <>
          <p className="text-sm text-gray-700">
            {resultados.filter((r) => r.ok).length} de {resultados.length} empleados creados.
          </p>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
            {resultados.map((r, i) => (
              <div key={i} className="px-3 py-2 flex items-center justify-between text-xs gap-2">
                <span className="text-gray-700 truncate">{r.email}</span>
                <span className={r.ok ? 'text-green-700 shrink-0' : 'text-red-600 shrink-0'}>
                  {r.ok ? 'Creado' : (MENSAJES_ERROR[r.error ?? ''] ?? 'Error')}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={descargarResultados}
              className="bg-navy text-white rounded-md px-4 py-2 text-sm font-medium"
            >
              Descargar CSV con las contraseñas
            </button>
            <button onClick={reiniciar} className="text-sm text-celeste underline">
              Cargar otro archivo
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Compartí las contraseñas de forma segura. Cada empleado puede cambiar la suya desde su cuenta.
          </p>
        </>
      )}
    </div>
  );
}
