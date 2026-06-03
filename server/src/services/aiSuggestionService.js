import db from '../db.js';
import { generateFinalTexts, normalize, tokenize } from './text.js';

const synonyms = {
  ABRACADEIRA: ['CLAMP', 'PRESILHA', 'FIXADOR'],
  ABAFADOR: ['PROTETOR', 'PROTECAO', 'CONCHA'],
  RUIDO: ['AUDITIVO', 'SOM'],
  BOTA: ['BOTINA', 'CALCADO'],
  SEGURANCA: ['PROTECAO', 'EPI'],
  TRANSMISSOR: ['TRANSMITTER'],
  TRANSMITTER: ['TRANSMISSOR'],
  PRESSAO: ['PRESSURE'],
  PRESSURE: ['PRESSAO'],
  VALVULA: ['VALVE', 'REGISTRO'],
  VALVE: ['VALVULA'],
  ESFERA: ['BALL'],
  BALL: ['ESFERA'],
  ROLAMENTO: ['BEARING'],
  BEARING: ['ROLAMENTO'],
  FILTRO: ['FILTER'],
  FILTER: ['FILTRO'],
  CHAVE: ['SWITCH', 'INTERRUPTOR'],
  INTERRUPTOR: ['SWITCH', 'CHAVE'],
  SWITCH: ['CHAVE', 'INTERRUPTOR'],
  MANOMETRO: ['GAUGE'],
  GAUGE: ['MANOMETRO'],
  BOMBA: ['PUMP'],
  PUMP: ['BOMBA'],
  MOTOR: ['ACIONAMENTO'],
  SELO: ['SEAL', 'VEDACAO'],
  VEDACAO: ['SEAL', 'SELO'],
  SEAL: ['SELO', 'VEDACAO'],
  JUNTA: ['GASKET', 'GAXETA'],
  GAXETA: ['GASKET', 'JUNTA'],
  GASKET: ['JUNTA', 'GAXETA'],
  ACOPLAMENTO: ['COUPLING'],
  COUPLING: ['ACOPLAMENTO'],
  CABO: ['CONDUTOR'],
  SENSOR: ['DETECTOR']
};

const phraseSynonyms = {
  'TRANSMISSOR PRESSAO': ['PRESSURE TRANSMITTER', 'TRANSMITTER PRESSURE'],
  'PRESSURE TRANSMITTER': ['TRANSMISSOR PRESSAO', 'TRANSMITTER PRESSURE'],
  'TRANSMITTER PRESSURE': ['TRANSMISSOR PRESSAO', 'PRESSURE TRANSMITTER'],
  'VALVULA ESFERA': ['BALL VALVE', 'VALVE BALL'],
  'BALL VALVE': ['VALVULA ESFERA', 'VALVE BALL'],
  'ROLAMENTO ESFERA': ['BALL BEARING', 'BEARING BALL'],
  'BALL BEARING': ['ROLAMENTO ESFERA', 'BEARING BALL'],
  'BOTA SEGURANCA': ['SAFETY BOOTS', 'BOOTS SAFETY'],
  'SAFETY BOOTS': ['BOTA SEGURANCA', 'BOOTS SAFETY'],
  'FILTRO OLEO': ['OIL FILTER', 'FILTER OIL'],
  'OIL FILTER': ['FILTRO OLEO', 'FILTER OIL']
};

const primaryLabels = new Set(['NAME', 'NOME', 'MATERIAL NAME', 'DESCRIPTION', 'DESCRICAO', 'ITEM', 'TIPO', 'TYPE', 'ITEM NAME']);
const secondaryLabels = [
  'MANUFACTURER NAME', 'MANUFACTURER', 'FABRICANTE', 'MFR', 'FAB',
  'MANUFACTURER PART NUMBER', 'PART NUMBER', 'PARTNO', 'P/N', 'PN',
  'MODEL', 'MODELO', 'MATERIAL', 'COLOR', 'COR', 'SIZE', 'TAMANHO',
  'SENSOR FILL FLUID', 'FILL FLUID', 'FLUID', 'HOUSING MATERIAL',
  'CERTIFICATION', 'CERTIFICADO', 'CERTIFICATE', 'CARACTERISTICAS ADICIONAIS'
];
const secondaryTerms = new Set([
  'SILICONE', 'STAINLESS', 'STEEL', 'STAINLESS STEEL', 'CARBON', 'CARBON STEEL',
  'BLACK', 'PRETO', 'PVC', 'LEATHER', 'COURO', 'CERTIFICADO', 'CERTIFICATE',
  'CALIBRATION', 'HART', 'INMETRO', 'LCD', 'DISPLAY', 'BRACKET', 'SUPORTE',
  'FLUID', 'FLUIDO', 'SEAL', 'SELO', 'VEDACAO', 'COLOR', 'COR', 'SIZE',
  'TAMANHO', 'MATERIAL', 'CERTIFICATION', 'INOX', 'ACO', 'HART PROTOCOL'
]);

function cleanText(value = '') {
  return normalize(value).replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function addExpandedTerm(set, term) {
  const clean = cleanText(term);
  if (!clean) return;
  set.add(clean);
  tokenize(clean).forEach((token) => set.add(token));
  (synonyms[clean] || []).forEach((synonym) => set.add(cleanText(synonym)));
  (phraseSynonyms[clean] || []).forEach((synonym) => {
    const normalizedSynonym = cleanText(synonym);
    set.add(normalizedSynonym);
    tokenize(normalizedSynonym).forEach((token) => set.add(token));
  });
}

function phraseVariants(value = '') {
  const normalized = cleanText(value);
  const variants = new Set();
  if (!normalized) return [];
  variants.add(normalized);
  (phraseSynonyms[normalized] || []).forEach((item) => variants.add(cleanText(item)));
  const commaParts = normalize(value).split(',').map(cleanText).filter(Boolean);
  if (commaParts.length >= 2) {
    variants.add(commaParts.join(' '));
    variants.add([...commaParts].reverse().join(' '));
  }
  return [...variants].filter(Boolean);
}

function labelMatches(label, labels) {
  const normalizedLabel = cleanText(label);
  return labels.some((item) => normalizedLabel === cleanText(item));
}

function parseStructuredFields(longText = '') {
  const lines = String(longText || '').split(/\r?\n|;/).map((line) => line.trim()).filter(Boolean);
  const fields = [];
  for (const line of lines) {
    const match = line.match(/^\s*([^:]{2,60})\s*:\s*(.+?)\s*$/);
    if (!match) continue;
    const label = cleanText(match[1]);
    const value = match[2].trim();
    if (!label || !value) continue;
    fields.push({
      label,
      value,
      normalizedValue: cleanText(value),
      tokens: tokenize(value),
      primary: primaryLabels.has(label),
      secondary: labelMatches(label, secondaryLabels)
    });
  }
  return fields;
}

function buildMaterialContext(material = {}) {
  const briefText = material.descricao || '';
  const longText = material.texto_longo_original || '';
  const extraText = [material.tipo_material, material.fabricante, material.part_number, material.modelo, material.dimensao, material.material, material.aplicacao].join(' ');
  const fields = parseStructuredFields(longText);
  const primaryFields = fields.filter((field) => field.primary);
  const secondaryFields = fields.filter((field) => field.secondary);
  const firstRelevantLine = String(longText || '').split(/\r?\n|;/).map((line) => line.trim()).find((line) => {
    if (!line) return false;
    const label = cleanText(line.split(':')[0] || '');
    return !labelMatches(label, secondaryLabels);
  }) || '';
  const primaryText = [
    briefText,
    material.tipo_material,
    ...primaryFields.map((field) => field.value),
    firstRelevantLine
  ].join(' ');
  const secondaryText = [
    material.fabricante, material.part_number, material.modelo, material.dimensao, material.material,
    ...secondaryFields.map((field) => field.value)
  ].join(' ');
  const normalizedLong = cleanText(longText);
  const secondaryFound = [...secondaryTerms].filter((term) => {
    const clean = cleanText(term);
    return clean && normalizedLong.includes(clean);
  });
  return {
    briefText,
    longText,
    extraText,
    materialText: [briefText, longText, extraText].join(' '),
    fields,
    primaryFields,
    secondaryFields,
    primaryText,
    secondaryText,
    primaryTokens: new Set(tokenize(primaryText)),
    briefTokens: new Set(tokenize(briefText)),
    longTokens: new Set(tokenize(longText)),
    secondaryTokens: new Set([...tokenize(secondaryText), ...secondaryFound.flatMap(tokenize)]),
    materialTokens: new Set(tokenize([briefText, longText, extraText].join(' '))),
    briefTokenList: tokenize(briefText),
    longTokenList: tokenize(longText),
    primaryTokenList: tokenize(primaryText),
    normalizedBrief: cleanText(briefText),
    normalizedLong,
    normalizedPrimary: cleanText(primaryText),
    secondaryFound
  };
}

function parseAttributes(pdm = {}) {
  try {
    return JSON.parse(pdm.atributos_dt || '[]');
  } catch {
    return [];
  }
}

export function preparePdmsForMatching(pdms = []) {
  const prepared = pdms.map((pdm) => {
    const pdmName = pdm.nome_valido || pdm.nome_pdm || '';
    const attributes = parseAttributes(pdm);
    const nameTokens = tokenize(pdmName);
    const expandedTerms = new Set();
    addExpandedTerm(expandedTerms, pdmName);
    nameTokens.forEach((term) => addExpandedTerm(expandedTerms, term));
    const attributeText = attributes.map((attr) => attr.attribute_name).join(' ');
    const normalizedPdmName = cleanText(pdmName);
    return {
      ...pdm,
      _attributes: attributes,
      _keywords: tokenize(pdm.palavra_chave || pdmName),
      _pdmTokens: tokenize(`${pdmName} ${pdm.descricao_pdm || ''} ${pdm.tipo_material || ''} ${attributeText}`),
      _pdmNameTokens: nameTokens,
      _expandedTerms: [...expandedTerms],
      _phraseVariants: phraseVariants(pdmName).flatMap((variant) => [variant, ...(phraseSynonyms[variant] || []).map(cleanText)]),
      _normalizedPdmName: normalizedPdmName,
      _firstPdmTerm: normalizedPdmName.split(' ')[0],
      _isSecondaryConcept: nameTokens.length > 0 && nameTokens.every((term) => secondaryTerms.has(term))
    };
  });
  const termIndex = new Map();
  for (const pdm of prepared) {
    const terms = new Set([...(pdm._pdmNameTokens || []), ...(pdm._expandedTerms || [])].filter((term) => term.length > 2));
    terms.forEach((term) => {
      if (!termIndex.has(term)) termIndex.set(term, []);
      termIndex.get(term).push(pdm);
    });
  }
  prepared._termIndex = termIndex;
  prepared._fallbackPdm = prepared.find((pdm) => String(pdm.id_pdm) === '1') || null;
  return prepared;
}

function orderedTokenBonus(sourceTokens, pdmTokens) {
  let cursor = -1;
  let ordered = 0;
  for (const token of pdmTokens) {
    const nextIndex = sourceTokens.indexOf(token, cursor + 1);
    if (nextIndex >= 0) {
      ordered += 1;
      cursor = nextIndex;
    }
  }
  return pdmTokens.length ? Math.round((ordered / pdmTokens.length) * 12) : 0;
}

function tokenMatches(expectedTokens, tokenSet) {
  return expectedTokens.filter((term) => tokenSet.has(term));
}

function phraseMatch(variants, normalizedSource) {
  return variants.find((variant) => variant && normalizedSource.includes(variant)) || '';
}

function hasEquivalentTokenMatch(term, context) {
  if (context.materialTokens.has(term)) return true;
  return (synonyms[term] || []).some((synonym) => context.materialTokens.has(cleanText(synonym)));
}

function scoreMaterial(material, pdm) {
  const start = Date.now();
  const pdmName = pdm.nome_valido || pdm.nome_pdm || '';
  const context = buildMaterialContext(material);
  const briefTokens = context.briefTokens;
  const longTokens = context.longTokens;
  const tokens = context.materialTokens;
  const keywords = pdm._keywords || tokenize(pdm.palavra_chave || pdmName);
  const pdmTokens = pdm._pdmTokens || tokenize(pdmName);
  const pdmNameTokens = pdm._pdmNameTokens || tokenize(pdmName);
  const expandedTerms = pdm._expandedTerms || pdmNameTokens;
  const phraseOptions = [...new Set([pdm._normalizedPdmName, ...(pdm._phraseVariants || [])].filter(Boolean))];
  const normalizedPdmName = pdm._normalizedPdmName || cleanText(pdmName);

  if (String(pdm.id_pdm) === '1') {
    return { score: -1, confidence: 0, reasons: ['PDM reservado para itens sem padrao'], matchedWords: [], doubtfulWords: [], processingMs: Date.now() - start };
  }

  let points = 0;
  const reasons = [];
  const matchedWords = new Set();
  const doubtfulWords = new Set();
  const ignoredSecondaryWords = new Set();
  let primaryEvidence = 0;
  let secondaryEvidence = 0;
  let matchedField = '';

  const primaryPhrase = phraseMatch(phraseOptions, context.normalizedPrimary);
  const briefPhrase = phraseMatch(phraseOptions, context.normalizedBrief);
  const longPhrase = phraseMatch(phraseOptions, context.normalizedLong);

  if (primaryPhrase) {
    points += 104;
    primaryEvidence += 1;
    const field = context.primaryFields.find((item) => item.normalizedValue.includes(primaryPhrase));
    matchedField = field ? `${field.label}: ${field.value}` : 'Texto breve/tipo principal';
    reasons.push(`Match identificado pelo campo principal "${matchedField}"`);
    pdmNameTokens.forEach((term) => matchedWords.add(term));
  } else if (briefPhrase) {
    points += 96;
    primaryEvidence += 1;
    matchedField = 'Texto breve';
    reasons.push('correspondencia direta do Nome Valido no Texto breve');
    pdmNameTokens.forEach((term) => matchedWords.add(term));
  } else if (longPhrase) {
    const appearsOnlySecondary = context.secondaryTokens.has(normalizedPdmName) || pdm._isSecondaryConcept;
    points += appearsOnlySecondary ? 18 : 58;
    if (appearsOnlySecondary) secondaryEvidence += 1;
    else primaryEvidence += 1;
    reasons.push(appearsOnlySecondary
      ? 'Nome Valido encontrado somente como atributo secundario no Texto Longo'
      : 'correspondencia direta do Nome Valido no Texto Longo');
    pdmNameTokens.forEach((term) => matchedWords.add(term));
  }

  const primaryNameMatches = tokenMatches(pdmNameTokens, context.primaryTokens);
  const briefNameMatches = tokenMatches(pdmNameTokens, briefTokens);
  const longNameMatches = tokenMatches(pdmNameTokens, longTokens);
  const secondaryNameMatches = tokenMatches(pdmNameTokens, context.secondaryTokens);
  const synonymPrimaryMatches = expandedTerms.filter((term) => !pdmNameTokens.includes(term) && context.primaryTokens.has(term));
  briefNameMatches.forEach((term) => matchedWords.add(term));
  longNameMatches.forEach((term) => matchedWords.add(term));
  synonymPrimaryMatches.forEach((term) => matchedWords.add(term));
  secondaryNameMatches.forEach((term) => ignoredSecondaryWords.add(term));
  context.secondaryFound.forEach((term) => ignoredSecondaryWords.add(cleanText(term)));
  pdmNameTokens.filter((term) => !hasEquivalentTokenMatch(term, context)).forEach((term) => doubtfulWords.add(term));

  if (pdmNameTokens.length) {
    const primaryRatio = primaryNameMatches.length / pdmNameTokens.length;
    const briefRatio = briefNameMatches.length / pdmNameTokens.length;
    const longRatio = longNameMatches.length / pdmNameTokens.length;
    if (primaryRatio > 0 && primaryRatio < 1) {
      points += Math.round(primaryRatio * 72);
      primaryEvidence += 1;
      reasons.push(`termos do Nome Valido no tipo principal: ${primaryNameMatches.join(', ')}`);
    }
    if (briefRatio > 0 && briefRatio < 1) {
      points += Math.round(briefRatio * 52);
      primaryEvidence += 1;
      reasons.push(`termos do Nome Valido no Texto breve: ${briefNameMatches.join(', ')}`);
    }
    if (longRatio > 0 && longRatio < 1) {
      const secondaryOnlyTerms = longNameMatches.every((term) => context.secondaryTokens.has(term) || secondaryTerms.has(term));
      points += Math.round(longRatio * (secondaryOnlyTerms ? 10 : 28));
      if (secondaryOnlyTerms) secondaryEvidence += 1;
      else primaryEvidence += 1;
      reasons.push(secondaryOnlyTerms
        ? `termos do Nome Valido no Texto Longo sao atributos secundarios: ${longNameMatches.join(', ')}`
        : `termos do Nome Valido no Texto Longo: ${longNameMatches.join(', ')}`);
    }
  }

  for (const keyword of keywords) {
    if (briefTokens.has(keyword)) {
      points += 12;
      primaryEvidence += 1;
      matchedWords.add(keyword);
      reasons.push(`termo tecnico ${keyword} no Texto breve`);
    } else if (longTokens.has(keyword)) {
      const secondaryKeyword = context.secondaryTokens.has(keyword) || secondaryTerms.has(keyword);
      points += secondaryKeyword ? 2 : 7;
      if (secondaryKeyword) secondaryEvidence += 1;
      else primaryEvidence += 1;
      matchedWords.add(keyword);
      reasons.push(secondaryKeyword ? `termo tecnico ${keyword} encontrado como atributo secundario` : `termo tecnico ${keyword} no Texto Longo`);
    }
  }

  const synonymMatches = expandedTerms.filter((term) => !pdmNameTokens.includes(term) && tokens.has(term));
  if (synonymMatches.length) {
    const primarySynonyms = synonymMatches.filter((term) => context.primaryTokens.has(term) || briefTokens.has(term));
    points += Math.min(primarySynonyms.length * 18 + (synonymMatches.length - primarySynonyms.length) * 4, 36);
    if (primarySynonyms.length) primaryEvidence += 1;
    synonymMatches.forEach((term) => matchedWords.add(term));
    reasons.push(`sinonimo(s) encontrado(s): ${synonymMatches.slice(0, 4).join(', ')}`);
  }

  points += orderedTokenBonus(context.primaryTokenList, pdmNameTokens);
  points += orderedTokenBonus(context.briefTokenList, pdmNameTokens);
  points += Math.round((pdmTokens.filter((term) => tokens.has(term)).length / Math.max(pdmTokens.length, 1)) * 18);

  const firstPdmTerm = pdm._firstPdmTerm || normalizedPdmName.split(' ')[0];
  if (firstPdmTerm && context.normalizedBrief.includes(firstPdmTerm)) {
    points += 10;
    primaryEvidence += 1;
    matchedWords.add(firstPdmTerm);
    reasons.push('termo principal do PDM encontrado no Texto breve');
  }

  if (normalize(material.tipo_material) && normalize(material.tipo_material) === normalize(pdm.tipo_material)) {
    points += 8;
    primaryEvidence += 1;
    reasons.push('tipo de material compativel');
  }

  const matchedOnlySecondary = primaryEvidence === 0 && secondaryEvidence > 0;
  if (matchedOnlySecondary || (pdm._isSecondaryConcept && primaryEvidence === 0)) {
    points = Math.min(points, 41);
    reasons.unshift('Match baseado em atributo secundario, requer validacao');
  }

  return {
    score: points,
    confidence: Math.min(points, 98),
    reasons,
    matchedField,
    matchedWords: [...matchedWords],
    doubtfulWords: [...new Set([...doubtfulWords, ...ignoredSecondaryWords])],
    secondaryOnly: matchedOnlySecondary || (pdm._isSecondaryConcept && primaryEvidence === 0),
    processingMs: Date.now() - start
  };
}

function formatAlternative(item) {
  if (!item || String(item.id_pdm) === '1') return '';
  return `${item.id_pdm} - ${item.nome_valido || item.nome_pdm} (${item.confidence}%)`;
}

export async function suggestForMaterial(material, preparedPdms = null) {
  const start = Date.now();
  const pdms = preparedPdms || preparePdmsForMatching(await db.prepare('SELECT * FROM pdms').all());
  const fallbackPdm = pdms._fallbackPdm || pdms.find((pdm) => String(pdm.id_pdm) === '1');
  const materialTokens = tokenize([material.descricao, material.texto_longo_original, material.tipo_material, material.fabricante, material.modelo].join(' '));
  const candidateMap = new Map();
  const termIndex = pdms._termIndex;
  if (termIndex) {
    materialTokens.forEach((term) => {
      (termIndex.get(term) || []).forEach((pdm) => candidateMap.set(pdm.id_pdm, pdm));
    });
  }
  const candidates = candidateMap.size ? [...candidateMap.values()] : pdms.filter((pdm) => String(pdm.id_pdm) !== '1').slice(0, 300);
  const ranked = [];

  for (const pdm of candidates) {
    const result = scoreMaterial(material, pdm);
    ranked.push({ ...pdm, ...result });
  }
  ranked.sort((a, b) => b.score - a.score);

  const best = ranked[0] || null;
  const pdm = best && best.score >= 25 ? best : fallbackPdm || null;
  const confidence = pdm && String(pdm.id_pdm) !== '1' ? pdm.confidence : 0;
  let status = 'REVISAR';
  if (pdm?.secondaryOnly) status = 'VALIDAR';
  else if (String(pdm?.id_pdm) !== '1' && confidence >= 75) status = 'OK';
  else if (String(pdm?.id_pdm) !== '1' && confidence >= 42) status = 'VALIDAR';

  const finalTexts = generateFinalTexts(material, pdm);
  if (finalTexts.hasMissingInfo && status === 'OK') status = 'VALIDAR';
  if (!pdm || String(pdm.id_pdm) === '1') status = 'REVISAR';

  const alternatives = ranked
    .filter((item) => String(item.id_pdm) !== String(pdm?.id_pdm) && String(item.id_pdm) !== '1' && item.confidence >= 25)
    .slice(0, 3);

  return {
    suggested_pdm_id: pdm?.id_pdm || '',
    suggested_pdm_name: pdm?.nome_valido || pdm?.nome_pdm || '',
    confidence,
    suggestion_reason: pdm && String(pdm.id_pdm) !== '1'
      ? pdm.reasons.slice(0, 6).join('; ')
      : 'Nenhum PDM razoavel encontrado; usado (NAO-PADRONIZADO)',
    matched_words: (pdm?.matchedWords || []).slice(0, 12).join(', '),
    doubtful_words: (pdm?.doubtfulWords || []).slice(0, 12).join(', '),
    alternative_1: formatAlternative(alternatives[0]),
    alternative_2: formatAlternative(alternatives[1]),
    alternative_3: formatAlternative(alternatives[2]),
    processing_ms: Date.now() - start,
    status,
    ...finalTexts
  };
}
