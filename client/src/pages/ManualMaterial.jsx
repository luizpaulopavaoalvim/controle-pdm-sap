import React, { useState } from 'react';
import PageHeader from '../components/PageHeader';
import { api } from '../services/api';

const initial = {
  codigo: '', descricao: '', texto_longo_original: '', centro: '', deposito: '', tipo_material: '', fabricante: '',
  part_number: '', modelo: '', dimensao: '', material: '', aplicacao: '', status: '', observacao: ''
};

export default function ManualMaterial({ user }) {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState('');

  async function submit(event) {
    event.preventDefault();
    const { data } = await api.post('/materials', { ...form, user: user.username });
    setMessage(`Material ${data.codigo} salvo com PDM sugerido ${data.suggested_pdm_name || 'não encontrado'}.`);
    setForm(initial);
  }

  return (
    <>
      <PageHeader title="Cadastro Manual de Material" subtitle="Cadastre um item individual e processe a sugestão de PDM automaticamente." />
      <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          {Object.keys(initial).map((field) => (
            <label key={field} className="text-sm font-bold text-slate-700">
              {field.replace('_', ' ').toUpperCase()}
              <input required={['codigo','descricao'].includes(field)} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-normal" />
            </label>
          ))}
        </div>
        <button className="mt-5 rounded-md bg-sap-blue px-4 py-2 font-bold text-white">Cadastrar e processar</button>
        {message && <p className="mt-3 text-sm font-bold text-sap-green">{message}</p>}
      </form>
    </>
  );
}
