import xlsx from 'xlsx';

export function readWorkbookRows(path, sheetName = null) {
  const workbook = xlsx.readFile(path);
  const selectedSheetName = sheetName && workbook.Sheets[sheetName] ? sheetName : workbook.SheetNames[0];
  const sheet = workbook.Sheets[selectedSheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: '' });
}

export function normalizeHeader(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function isEmptyRow(row = {}) {
  return Object.values(row).every((value) => String(value ?? '').trim() === '');
}

export function mapRow(row, mapping) {
  const normalized = {};
  for (const [key, aliases] of Object.entries(mapping)) {
    const found = aliases.find((alias) => Object.prototype.hasOwnProperty.call(row, alias));
    normalized[key] = found ? row[found] : '';
  }
  return normalized;
}

export function mapRowFlexible(row, mapping) {
  const normalizedKeys = {};
  Object.keys(row).forEach((key) => {
    normalizedKeys[normalizeHeader(key)] = key;
  });

  const mapped = {};
  for (const [target, aliases] of Object.entries(mapping)) {
    const foundAlias = aliases.map(normalizeHeader).find((alias) => normalizedKeys[alias]);
    mapped[target] = foundAlias ? row[normalizedKeys[foundAlias]] : '';
  }
  return mapped;
}

export function readWorkbookRowsByDetectedHeader(path, mapping, { sheetName = null, maxHeaderScan = 20 } = {}) {
  const workbook = xlsx.readFile(path);
  const normalizedAliases = Object.fromEntries(
    Object.entries(mapping).map(([target, aliases]) => [target, aliases.map(normalizeHeader)])
  );

  function detectInSheet(selectedSheetName) {
    const sheet = workbook.Sheets[selectedSheetName];
    const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
    let headerIndex = -1;
    let headers = [];
    for (let index = 0; index < Math.min(matrix.length, maxHeaderScan); index += 1) {
      const candidate = matrix[index].map((cell) => String(cell ?? '').trim());
      const normalizedCandidate = candidate.map(normalizeHeader);
      const hasAllRequired = Object.values(normalizedAliases)
        .every((aliases) => aliases.some((alias) => normalizedCandidate.includes(alias)));
      if (hasAllRequired) {
        headerIndex = index;
        headers = candidate;
        break;
      }
    }

    if (headerIndex < 0) {
      const firstRow = matrix[0] || [];
      return {
        rows: [],
        sheetName: selectedSheetName,
        headerRowNumber: 0,
        columns: {
          original: firstRow.map((cell) => String(cell ?? '').trim()).filter(Boolean),
          normalized: firstRow.map(normalizeHeader).filter(Boolean)
        },
        error: 'Cabecalho obrigatorio nao encontrado'
      };
    }

    const rows = matrix.slice(headerIndex + 1).map((line) => {
      const row = {};
      headers.forEach((header, index) => {
        const key = String(header ?? '').trim();
        if (key) row[key] = line[index] ?? '';
      });
      return row;
    });

    return {
      rows,
      sheetName: selectedSheetName,
      headerRowNumber: headerIndex + 1,
      columns: {
        original: headers.filter(Boolean),
        normalized: headers.filter(Boolean).map(normalizeHeader)
      },
      error: ''
    };
  }

  const preferred = sheetName && workbook.Sheets[sheetName] ? [sheetName] : [];
  const candidates = [...preferred, ...workbook.SheetNames.filter((name) => !preferred.includes(name))];
  let firstError = null;
  for (const candidateSheetName of candidates) {
    const detected = detectInSheet(candidateSheetName);
    if (!detected.error) return detected;
    if (!firstError) firstError = detected;
  }

  return firstError || {
    rows: [],
    sheetName: '',
    headerRowNumber: 0,
    columns: { original: [], normalized: [] },
    error: 'Cabecalho obrigatorio nao encontrado'
  };
}

export function describeColumns(rows = []) {
  const firstRow = rows.find((row) => Object.keys(row).length);
  const original = firstRow ? Object.keys(firstRow) : [];
  return {
    original,
    normalized: original.map((column) => normalizeHeader(column))
  };
}

export function workbookBuffer(rows, sheetName = 'Resultado') {
  const ws = xlsx.utils.json_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, sheetName);
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
