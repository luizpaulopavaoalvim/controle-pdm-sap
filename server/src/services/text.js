const ptToEn = {
  CAPACITOR: 'CAPACITOR',
  ELETROLITICO: 'ELECTROLYTIC',
  ROLAMENTO: 'BEARING',
  BOMBA: 'PUMP',
  CENTRIFUGA: 'CENTRIFUGAL',
  MOTOR: 'MOTOR',
  ELETRICO: 'ELECTRIC',
  VALVULA: 'VALVE',
  PRESSAO: 'PRESSURE',
  TRANSMISSOR: 'TRANSMITTER',
  SENSOR: 'SENSOR',
  CHAVE: 'SWITCH',
  INTERRUPTOR: 'SWITCH',
  MANOMETRO: 'GAUGE',
  CABO: 'CABLE',
  FILTRO: 'FILTER',
  OLEO: 'OIL',
  SELO: 'SEAL',
  VEDACAO: 'SEAL',
  JUNTA: 'GASKET',
  GAXETA: 'GASKET',
  ACOPLAMENTO: 'COUPLING',
  PARAFUSO: 'SCREW',
  MODULO: 'MODULE',
  ATUADOR: 'ACTUATOR',
  PNEUMATICO: 'PNEUMATIC',
  ABRACADEIRA: 'CLAMP',
  RUIDO: 'NOISE',
  ABAFADOR: 'MUFFLER',
  BOTA: 'BOOTS',
  SEGURANCA: 'SAFETY',
  COURO: 'LEATHER',
  PRETO: 'BLACK',
  TAMANHO: 'SIZE',
  CANO: 'SHAFT',
  LONGO: 'LONG',
  CORPO: 'BODY',
  COR: 'COLOR',
  TIPO: 'TYPE',
  CARACTERISTICAS: 'FEATURES',
  ADICIONAIS: 'ADDITIONAL',
  BRIGADISTA: 'FIREMAN',
  APLICACAO: 'APPLICATION',
  MODELO: 'MODEL',
  DIMENSAO: 'DIMENSION',
  MATERIAL: 'MATERIAL',
  FAB: 'MFR'
};

export function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

export function tokenize(value = '') {
  return normalize(value)
    .split(/[^A-Z0-9]+/)
    .filter((term) => term.length > 1);
}

export function translateTechnical(value = '') {
  return normalize(value)
    .replace(/\bATUADOR PNEUMATICO\b/g, 'PNEUMATIC ACTUATOR')
    .replace(/\bBOTA SEGURANCA\b/g, 'SAFETY BOOTS')
    .replace(/\bTRANSMISSOR PRESSAO\b/g, 'PRESSURE TRANSMITTER')
    .replace(/\bVALVULA ESFERA\b/g, 'BALL VALVE')
    .replace(/\bROLAMENTO ESFERA\b/g, 'BALL BEARING')
    .replace(/\bFILTRO OLEO\b/g, 'OIL FILTER')
    .split(/\s+/)
    .map((word) => ptToEn[word] || word)
    .join(' ');
}

export function limitSapShort(value = '') {
  const clean = normalize(value).replace(/\s+/g, ' ');
  if (clean.length <= 40) return clean;
  const words = clean.split(' ');
  let result = '';
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > 40) break;
    result = next;
  }
  return result || clean.slice(0, 40);
}

export function fillTemplate(template = '', material = {}) {
  const map = {
    CODIGO: material.codigo,
    DESCRICAO: material.descricao,
    TEXTO_BREVE: material.descricao,
    TEXTO_LONGO: material.texto_longo_original,
    NOME_PDM: material.nome_pdm || material.nome_valido,
    FABRICANTE: material.fabricante,
    PART_NUMBER: material.part_number,
    MODELO: material.modelo,
    DIMENSAO: material.dimensao,
    MATERIAL: material.material,
    APLICACAO: material.aplicacao,
    TIPO_MATERIAL: material.tipo_material
  };
  return normalize(template).replace(/\{([A-Z_]+)\}/g, (_, key) => {
    const value = normalize(map[key] || '');
    return value || 'INFORMACAO AUSENTE';
  }).replace(/\s*;\s*/g, '; ').replace(/\s+/g, ' ').trim();
}

export function missingEssential(text = '') {
  return normalize(text).includes('INFORMACAO AUSENTE');
}

function parseAttributes(pdm = {}) {
  try {
    return JSON.parse(pdm.atributos_dt || '[]');
  } catch {
    return [];
  }
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTrailingValue(text, labels) {
  const normalized = normalize(text);
  for (const label of labels) {
    const regex = new RegExp(`\\b${escapeRegExp(normalize(label))}\\b\\s*[:\\-/]?\\s*([A-Z0-9][A-Z0-9._\\-/]{1,})`, 'i');
    const match = normalized.match(regex);
    if (match?.[1]) return match[1].replace(/[;,.]$/, '');
  }
  return '';
}

function extractPartNumberAndManufacturer(material = {}) {
  const source = `${material.descricao || ''}; ${material.texto_longo_original || ''}`;
  const partNumber = normalize(material.part_number || '') || extractTrailingValue(source, ['PART NUMBER', 'PARTNO', 'P/N', 'PN', 'MODELO']);
  const manufacturer = normalize(material.fabricante || '') || extractTrailingValue(source, ['FABRICANTE', 'MANUFACTURER', 'MFR', 'FAB']);
  return { partNumber, manufacturer };
}

function extractAttributeValue(source, attributeName, allAttributes) {
  const normalizedSource = normalize(source);
  const normalizedAttr = normalize(attributeName);
  if (!normalizedSource || !normalizedAttr) return '';

  const nextAttrs = allAttributes
    .map((attr) => normalize(attr.attribute_name))
    .filter((attr) => attr && attr !== normalizedAttr)
    .map(escapeRegExp);
  const stopPattern = nextAttrs.length ? `(?=;|\\b(?:${nextAttrs.join('|')})\\b|$)` : '(?=;|$)';
  const explicit = normalizedSource.match(new RegExp(`\\b${escapeRegExp(normalizedAttr)}\\b\\s*[:\\-/]?\\s*(.{1,80}?)\\s*${stopPattern}`));
  if (explicit?.[1]) {
    return explicit[1].replace(/[;,.]$/, '').trim();
  }

  const tokens = tokenize(attributeName).filter((token) => token.length > 2);
  const foundToken = tokens.find((token) => normalizedSource.includes(token));
  if (!foundToken) return '';
  const tokenMatch = normalizedSource.match(new RegExp(`\\b${escapeRegExp(foundToken)}\\b\\s*[:\\-/]?\\s*([A-Z0-9][A-Z0-9\\s._\\-/]{1,40})`));
  return tokenMatch?.[1]?.replace(/[;,.]$/, '').trim() || '';
}

function suffixPartManufacturer({ partNumber, manufacturer }) {
  if (partNumber && manufacturer) return `${partNumber}/${manufacturer}`;
  return partNumber || manufacturer || '';
}

function translatePhrase(value = '') {
  return translateTechnical(value).replace(/\bBODY MATERIAL\b/g, 'BODY MATERIAL')
    .replace(/\bBODY COLOR\b/g, 'BODY COLOR')
    .replace(/\bBOOT SIZE\b/g, 'BOOT SIZE')
    .replace(/\bSHAFT TYPE\b/g, 'SHAFT TYPE')
    .replace(/\bADDITIONAL FEATURES\b/g, 'ADDITIONAL FEATURES');
}

export function generateFinalTexts(material, pdm) {
  const pdmName = pdm?.nome_valido || pdm?.nome_pdm || '';
  const materialForTemplate = { ...material, nome_pdm: pdmName, nome_valido: pdmName };
  if (!pdm) {
    const fallback = limitSapShort(material.descricao);
    return {
      short_pt: fallback,
      long_pt: `${normalize(material.descricao)}; PDM INFORMACAO AUSENTE`,
      short_en: limitSapShort(translateTechnical(fallback)),
      long_en: `${translateTechnical(material.descricao)}; PDM MISSING INFORMATION`,
      hasMissingInfo: true
    };
  }

  const attributes = parseAttributes(pdm);
  const source = `${material.descricao || ''}; ${material.texto_longo_original || ''}`;
  const ids = extractPartNumberAndManufacturer(material);
  const suffix = suffixPartManufacturer(ids);

  if (attributes.length) {
    const foundAttributes = attributes
      .map((attr) => ({
        ...attr,
        value: extractAttributeValue(source, attr.attribute_name, attributes)
      }))
      .filter((attr) => attr.value);
    const shortMain = ids.partNumber || material.modelo || '';
    const shortPt = limitSapShort(`${pdmName} ${shortMain}`);
    const longParts = [normalize(pdmName)];
    foundAttributes.forEach((attr) => {
      longParts.push(`${normalize(attr.attribute_name)}: ${normalize(attr.value)}`);
    });
    if (suffix) longParts.push(suffix);
    const longPt = `${longParts.join('; ')}`;
    const shortEn = limitSapShort(translatePhrase(shortPt));
    const longEnParts = [translatePhrase(pdmName)];
    foundAttributes.forEach((attr) => {
      longEnParts.push(`${translatePhrase(attr.attribute_name)}: ${translatePhrase(attr.value)}`);
    });
    if (suffix) longEnParts.push(suffix);

    return {
      short_pt: shortPt,
      long_pt: longPt,
      short_en: shortEn,
      long_en: longEnParts.join('; '),
      hasMissingInfo: foundAttributes.length < attributes.length || !suffix
    };
  }

  const hasOriginalLong = Boolean(normalize(material.texto_longo_original || material.descricao));
  const defaultShort = `${pdmName} ${material.descricao || ''}`;
  const defaultLong = `${pdmName}; ${material.texto_longo_original || material.descricao || ''}`;
  const shortPtBase = fillTemplate(pdm.estrutura_texto_breve_pt || defaultShort, materialForTemplate);
  const longPt = fillTemplate(pdm.estrutura_texto_longo_pt || defaultLong, materialForTemplate);
  const shortEnBase = fillTemplate(pdm.estrutura_texto_breve_en || translateTechnical(shortPtBase), materialForTemplate);
  const longEn = fillTemplate(pdm.estrutura_texto_longo_en || translateTechnical(longPt), materialForTemplate);

  return {
    short_pt: limitSapShort(shortPtBase),
    long_pt: longPt,
    short_en: limitSapShort(shortEnBase),
    long_en: longEn,
    hasMissingInfo: !hasOriginalLong || missingEssential(`${shortPtBase} ${longPt} ${shortEnBase} ${longEn}`)
  };
}
