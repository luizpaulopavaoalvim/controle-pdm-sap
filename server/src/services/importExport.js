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
