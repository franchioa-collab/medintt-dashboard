import type { ResultadoValidacion } from '@/lib/presentismo/database.types';

export default function BadgeResultado({
  resultado,
  tarde,
}: {
  resultado: ResultadoValidacion;
  tarde: boolean;
}) {
  const dentro = resultado === 'dentro_de_zona';

  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className={dentro ? 'text-green-700' : 'text-red-600 font-medium'}>
        {dentro ? 'En zona' : 'Fuera de zona'}
      </span>
      {tarde && (
        <span className="px-1.5 py-0.5 rounded bg-amarillo text-gray-900 text-xs font-medium">
          Tarde
        </span>
      )}
    </span>
  );
}
