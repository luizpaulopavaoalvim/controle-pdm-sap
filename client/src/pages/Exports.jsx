import React from 'react';
import { Download } from 'lucide-react';
import { api } from '../services/api';

function saveBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function ExportButtons({ user }) {
  async function exportFile(path, filename) {
    const { data } = await api.get(path, {
      params: { user: user.username },
      responseType: 'blob'
    });
    saveBlob(data, filename);
  }

  return (
    <>
      <button onClick={() => exportFile('/export/final', 'resultado-final-pdm-sap.xlsx')} className="inline-flex items-center gap-2 rounded-md bg-sap-green px-3 py-2 text-sm font-bold text-white">
        <Download size={16} /> Exportar final
      </button>
      <button onClick={() => exportFile('/export/complete', 'base-completa-pdm-sap.xlsx')} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">
        <Download size={16} /> Exportar completo
      </button>
    </>
  );
}
