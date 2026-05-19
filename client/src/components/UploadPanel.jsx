import { Upload } from 'lucide-react';
import React, { useState } from 'react';

export default function UploadPanel({ title, description, onUpload }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState([]);

  async function submit(event) {
    event.preventDefault();
    if (!file) return;
    setLoading(true);
    setMessage('');
    setPreview([]);
    try {
      const result = await onUpload(file);
      if (typeof result.read === 'number') {
        const attrs = typeof result.totalAttributes === 'number' ? ` Atributos importados: ${result.totalAttributes}.` : '';
        const reasons = result.ignoredReasons && Object.keys(result.ignoredReasons).length
          ? ` Motivos: ${Object.entries(result.ignoredReasons).map(([reason, count]) => `${reason} (${count})`).join('; ')}.`
          : '';
        const errors = result.errors?.length ? ` Erros: ${result.errors.map((item) => typeof item === 'string' ? item : `linha ${item.row}: ${item.reason}`).slice(0, 5).join('; ')}.` : '';
        setMessage(`Lidos: ${result.read}. Importados: ${result.imported || 0}. Ignorados: ${result.ignored || 0}.${attrs}${reasons}${errors}`);
      } else {
        setMessage(`${result.imported || 0} registros importados com sucesso.`);
      }
      setPreview(result.preview || []);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Falha ao importar arquivo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-fiori">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-md bg-sap-soft p-2 text-sap-blue"><Upload size={22} /></div>
        <div>
          <h2 className="text-lg font-bold text-sap-dark">{title}</h2>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row">
        <input
          type="file"
          accept=".xlsx"
          onChange={(event) => setFile(event.target.files?.[0])}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-sap-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-60" disabled={loading || !file}>
          {loading ? 'Importando...' : 'Importar Excel'}
        </button>
      </div>
      {message && <p className="mt-3 text-sm font-semibold text-slate-700">{message}</p>}
      {preview.length > 0 && (
        <div className="mt-5 overflow-auto rounded-md border border-slate-200">
          <table className="min-w-full">
            <thead>
              <tr><th>Id Padrão</th><th>Nome Válido</th><th>Atributos</th><th>Lista de atributos técnicos</th></tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={`${row.id_padrao}-${row.nome_valido}`}>
                  <td className="font-bold text-sap-blue">{row.id_padrao}</td>
                  <td>{row.nome_valido}</td>
                  <td>{row.attribute_count}</td>
                  <td>{(row.attributes || []).map((attr) => attr.attribute_name).join('; ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </form>
  );
}
