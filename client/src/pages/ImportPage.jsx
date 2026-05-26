import React, { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import UploadPanel from '../components/UploadPanel';
import { api } from '../services/api';

export function ImportPdm({ user }) {
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState('replace');

  async function loadStatus() {
    const { data } = await api.get('/pdms/status');
    setStatus(data);
  }

  useEffect(() => {
    loadStatus();
  }, []);

  return (
    <>
      <PageHeader title="Importacao da Base de PDM" subtitle="Modelo esperado: Id Padrao | Nome Valido. Colunas extras serao ignoradas." />
      <section className="mb-5 rounded-lg border border-slate-200 bg-white p-5 shadow-fiori">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-xs font-bold uppercase text-slate-500">Status da base PDM</div>
            <div className="mt-1 text-lg font-bold text-sap-dark">{status?.count > 1 ? 'PDM padrao ja importado' : 'Aguardando importacao'}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-slate-500">PDMs salvos</div>
            <div className="mt-1 text-lg font-bold text-sap-blue">{status?.count || 0}</div>
          </div>
          <div>
            <div className="text-xs font-bold uppercase text-slate-500">Ultima importacao</div>
            <div className="mt-1 text-sm font-semibold text-slate-700">{status?.lastImportedAt || 'Ainda nao importado'}</div>
          </div>
        </div>
        {status?.count > 1 && (
          <div className="mt-4 flex flex-col gap-2 md:flex-row">
            <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold">
              <input type="radio" checked={mode === 'keep'} onChange={() => setMode('keep')} />
              Manter base atual
            </label>
            <label className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold">
              <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              Substituir base PDM existente
            </label>
          </div>
        )}
      </section>
      <UploadPanel
        title="Base de PDM"
        description="O sistema usa automaticamente a primeira aba, incluindo Planilha1. Informe Id Padrao e Nome Valido; qualquer coluna extra sera ignorada."
        onUpload={async (file) => {
          const form = new FormData();
          form.append('file', file);
          form.append('user', user.username);
          form.append('mode', mode);
          const { data } = await api.post('/pdms/import', form);
          await loadStatus();
          return data;
        }}
      />
    </>
  );
}

export function ImportMaterials({ user }) {
  return (
    <>
      <PageHeader title="Importacao de Materiais" subtitle="Importe Codigo, Texto Breve e Texto Longo. A ordem da planilha sera preservada." />
      <UploadPanel
        title="Planilha de materiais"
        description="Campos aceitos: Codigo, Texto Breve e Texto Longo, incluindo variacoes de acentos, caixa e espacos."
        processingLabel="Processando materiais, aguarde..."
        onUpload={async (file) => {
          const form = new FormData();
          form.append('file', file);
          form.append('user', user.username);
          const { data } = await api.post('/materials/import', form);
          return data;
        }}
      />
    </>
  );
}
