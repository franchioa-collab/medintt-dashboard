export type EstadoPresentismo = 'a_horario' | 'tarde' | 'fuera_de_zona' | 'ausente';

export interface CoordenadasActuales {
  lat: number;
  lon: number;
  precisionMetros: number | null;
}

export type ErrorGeolocalizacion =
  | 'permiso_denegado'
  | 'no_disponible'
  | 'tiempo_agotado'
  | 'no_soportado';
