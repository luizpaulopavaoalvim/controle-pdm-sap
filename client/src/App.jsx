import React, { useMemo, useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import { ExportButtons } from './pages/Exports';
import History from './pages/History';
import { ImportMaterials, ImportPdm } from './pages/ImportPage';
import Login from './pages/Login';
import ManualMaterial from './pages/ManualMaterial';
import Materials from './pages/Materials';
import Pdms from './pages/Pdms';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('pdm-user');
    return saved ? JSON.parse(saved) : null;
  });
  const [active, setActive] = useState('dashboard');
  const isAdmin = user?.role === 'Admin';

  const content = useMemo(() => {
    if (!user) return null;
    if (isAdmin && active !== 'dashboard') {
      return <Dashboard user={user} message="Acesso somente leitura. Perfil autorizado apenas para acompanhamento do dashboard." />;
    }
    if (active === 'dashboard') return <Dashboard user={user} />;
    if (active === 'import-pdm') return <ImportPdm user={user} />;
    if (active === 'import-materials') return <ImportMaterials user={user} />;
    if (active === 'materials') return <Materials key="classification" user={user} />;
    if (active === 'final') return <Materials key="final-result" user={user} finalOnly />;
    if (active === 'manual-material') return <ManualMaterial user={user} />;
    if (active === 'pdms') return <Pdms user={user} />;
    if (active === 'history') return <History user={user} />;
    return <Dashboard user={user} />;
  }, [active, user, isAdmin]);

  function login(nextUser) {
    localStorage.setItem('pdm-user', JSON.stringify(nextUser));
    setUser(nextUser);
    setActive('dashboard');
  }

  function logout() {
    localStorage.removeItem('pdm-user');
    setUser(null);
  }

  if (!user) return <Login onLogin={login} />;

  return (
    <div className="flex min-h-screen bg-[#f5f7fa]">
      <Sidebar active={active} setActive={setActive} user={user} onLogout={logout} />
      <main className="min-w-0 flex-1 overflow-auto">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
          <div className="text-sm font-semibold text-slate-600">Ambiente MVP - PostgreSQL online - Usuario responsavel: {user.name}</div>
          {!isAdmin && <div className="flex gap-2"><ExportButtons user={user} /></div>}
        </header>
        <section className="p-6">{content}</section>
      </main>
    </div>
  );
}
