'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Sede } from '@/lib/presentismo/database.types';

export default function TogglesSupervisorSede({
  empleadoId,
  sedes,
}: {
  empleadoId: string;
  sedes: Sede[];
}) {
  const router = useRouter();
  const [guardandoId, setGuardandoId] = useState<string | null>(null);

  async function toggle(sede: Sede, marcar: boolean) {
    setGuardandoId(sede.id);
    await fetch(`/presentismo/api/admin/sedes/${sede.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supervisorId: marcar ? empleadoId : null }),
    });
    setGuardandoId(null);
    router.refresh();
  }

  if (sedes.length === 0) {
    return <p className="text-sm text-gray-500">Todavía no hay sedes cargadas.</p>;
  }

  return (
    <div className="space-y-2">
      {sedes.map((sede) => {
        const esSupervisor = sede.supervisor_id === empleadoId;
        return (
          <label key={sede.id} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={esSupervisor}
              disabled={guardandoId === sede.id}
              onChange={(e) => toggle(sede, e.target.checked)}
            />
            {sede.nombre}
          </label>
        );
      })}
    </div>
  );
}
