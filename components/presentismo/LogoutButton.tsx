'use client';

import { useRouter } from 'next/navigation';
import { crearClienteBrowser } from '@/lib/presentismo/supabase-browser';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = crearClienteBrowser();
    await supabase.auth.signOut();
    router.push('/presentismo/login');
    router.refresh();
  }

  return (
    <button onClick={handleLogout} className="text-sm text-white/80 hover:text-white underline">
      Salir
    </button>
  );
}
