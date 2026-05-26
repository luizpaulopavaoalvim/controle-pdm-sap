import db from '../db.js';
import { generateFinalTexts, normalize, tokenize } from './text.js';

const synonyms = {
  ABRACADEIRA: ['CLAMP', 'PRESILHA', 'FIXADOR'],
  ABAFADOR: ['PROTETOR', 'PROTECAO', 'CONCHA'],
  RUIDO: ['AUDITIVO', 'SOM'],
  BOTA: ['BOTINA', 'CALCADO'],
  SEGURANCA: ['PROTECAO', 'EPI'],
  VALVULA: ['REGISTRO'],
  MOTOR: ['ACIONAMENTO'],
  CABO: ['CONDUTOR'],
  SENSOR: ['TRANSMISSOR', 'DETECTOR']
};

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
    const expandedTerms = new Set(nameTokens);
    nameTokens.forEach((term) => (synonyms[term] || []).forEach((synonym) => expandedTerms.add(synonym)));
    const attributeText = attributes.map((attr) => attr.attribute_name).join(' ');
    const normalizedPdmName = normalize(pdmName).replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    return {
      ...pdm,
      _attributes: attributes,
      _keywords: tokenize(pdm.palavra_chave || pdmName),
      _pdmTokens: tokenize(`${pdmName} ${pdm.descricao_pdm || ''} ${pdm.tipo_material || ''} ${attributeText}`),
      _pdmNameTokens: nameTokens,
      _expandedTerms: [...expandedTerms],
      _normalizedPdmName: normalizedPdmName,
      _firstPdmTerm: normalizedPdmName.split(' ')[0]
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

function scoreMaterial(material, pdm) {
  const start = Date.now();
  const pdmName = pdm.nome_valido || pdm.nome_pdm || '';
  const briefText = material.descricao || '';
  const longText = material.texto_longo_original || '';
  const extraText = [material.tipo_material, material.fabricante, material.part_number, material.modelo, material.dimensao, material.material, material.aplicacao].join(' ');
  const materialText = [briefText, longText, extraText].join(' ');
  const briefTokenList = tokenize(briefText);
  const longTokenList = tokenize(longText);
  const materialTokenList = tokenize(materialText);
  const briefTokens = new Set(briefTokenList);
  const longTokens = new Set(longTokenList);
  const tokens = new Set(materialTokenList);
  const keywords = pdm._keywords || tokenize(pdm.palavra_chave || pdmName);
  const pdmTokens = pdm._pdmTokens || tokenize(pdmName);
  const pdmNameTokens = pdm._pdmNameTokens || tokenize(pdmName);
  const expandedTerms = pdm._expandedTerms || pdmNameTokens;
  const normalizedBrief = normalize(briefText).replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const normalizedLong = normalize(longText).replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  const normalizedPdmName = pdm._normalizedPdmName || normalize(pdmName).replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (String(pdm.id_pdm) === '1') {
    return { score: -1, confidence: 0, reasons: ['PDM reservado para itens sem padrao'], matchedWords: [], doubtfulWords: [], processingMs: Date.now() - start };
  }

  let points = 0;
  const reasons = [];
  const matchedWords = new Set();
  const doubtfulWords = new Set();

  if (normalizedPdmName && normalizedBrief.includes(normalizedPdmName)) {
    points += 96;
    reasons.push('correspondencia direta do Nome Valido no Texto breve');
    pdmNameTokens.forEach((term) => matchedWords.add(term));
  } else if (normalizedPdmName && normalizedLong.includes(normalizedPdmName)) {
    points += 82;
    reasons.push('correspondencia direta do Nome Valido no Texto Longo');
    pdmNameTokens.forEach((term) => matchedWords.add(term));
  }

  const briefNameMatches = pdmNameTokens.filter((term) => briefTokens.has(term));
  const longNameMatches = pdmNameTokens.filter((term) => longTokens.has(term));
  briefNameMatches.forEach((term) => matchedWords.add(term));
  longNameMatches.forEach((term) => matchedWords.add(term));
  pdmNameTokens.filter((term) => !tokens.has(term)).forEach((term) => doubtfulWords.add(term));

  if (pdmNameTokens.length) {
    const briefRatio = briefNameMatches.length / pdmNameTokens.length;
    const longRatio = longNameMatches.length / pdmNameTokens.length;
    if (briefRatio > 0 && briefRatio < 1) {
      points += Math.round(briefRatio * 52);
      reasons.push(`termos do Nome Valido no Texto breve: ${briefNameMatches.join(', ')}`);
    }
    if (longRatio > 0 && longRatio < 1) {
      points += Math.round(longRatio * 32);
      reasons.push(`termos do Nome Valido no Texto Longo: ${longNameMatches.join(', ')}`);
    }
  }

  for (const keyword of keywords) {
    if (briefTokens.has(keyword)) {
      points += 12;
      matchedWords.add(keyword);
      reasons.push(`termo tecnico ${keyword} no Texto breve`);
    } else if (longTokens.has(keyword)) {
      points += 7;
      matchedWords.add(keyword);
      reasons.push(`termo tecnico ${keyword} no Texto Longo`);
    }
  }

  const synonymMatches = expandedTerms.filter((term) => !pdmNameTokens.includes(term) && tokens.has(term));
  if (synonymMatches.length) {
    points += Math.min(synonymMatches.length * 7, 18);
    synonymMatches.forEach((term) => matchedWords.add(term));
    reasons.push(`sinonimo(s) encontrado(s): ${synonymMatches.slice(0, 4).join(', ')}`);
  }

  points += orderedTokenBonus(briefTokenList, pdmNameTokens);
  points += Math.round((pdmTokens.filter((term) => tokens.has(term)).length / Math.max(pdmTokens.length, 1)) * 18);

  const firstPdmTerm = pdm._firstPdmTerm || normalizedPdmName.split(' ')[0];
  if (firstPdmTerm && normalizedBrief.includes(firstPdmTerm)) {
    points += 10;
    matchedWords.add(firstPdmTerm);
    reasons.push('termo principal do PDM encontrado no Texto breve');
  }

  if (normalize(material.tipo_material) && normalize(material.tipo_material) === normalize(pdm.tipo_material)) {
    points += 8;
    reasons.push('tipo de material compativel');
  }

  return {
    score: points,
    confidence: Math.min(points, 98),
    reasons,
    matchedWords: [...matchedWords],
    doubtfulWords: [...doubtfulWords],
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
  if (String(pdm?.id_pdm) !== '1' && confidence >= 75) status = 'OK';
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
      ? pdm.reasons.slice(0, 5).join('; ')
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
