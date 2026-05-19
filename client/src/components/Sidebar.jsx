import React from 'react';
import { BarChart3, ClipboardCheck, Database, FileInput, FileSpreadsheet, History, Layers, LogOut, PackagePlus } from 'lucide-react';

const items = [
  ['dashboard', 'Dashboard', BarChart3],
  ['import-pdm', 'Importar PDM', Database],
  ['import-materials', 'Importar Materiais', FileInput],
  ['materials', 'Classificação', ClipboardCheck],
  ['final', 'Resultado Final', FileSpreadsheet],
  ['manual-material', 'Cadastro Material', PackagePlus],
  ['pdms', 'Cadastro PDM', Layers],
  ['history', 'Histórico', History]
];

export default function Sidebar({ active, setActive, user, onLogout }) {
  const visibleItems = user?.role === 'Admin' ? items.filter(([id]) => id === 'dashboard') : items;
  return (
    <aside className="flex h-screen w-72 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="text-lg font-bold text-sap-dark">Controle Inteligente</div>
        <div className="text-sm font-semibold text-sap-blue">PDM SAP</div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold transition ${
              active === id ? 'bg-sap-soft text-sap-blue' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
        {user?.role === 'Admin' && (
          <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-3 text-xs font-semibold text-sap-blue">
            Acesso somente leitura para acompanhamento do dashboard.
          </div>
        )}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <div className="mb-3 rounded-md bg-slate-50 p-3">
          <div className="text-sm font-bold text-slate-800">{user?.name}</div>
          <div className="text-xs text-slate-500">{user?.role}</div>
        </div>
        <button onClick={onLogout} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
          <LogOut size={17} /> Sair
        </button>
      </div>
    </aside>
  );
}
