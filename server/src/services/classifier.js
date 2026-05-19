import db from '../db.js';
import { generateFinalTexts, normalize, tokenize } from './text.js';

function parseAttributes(pdm = {}) {
  try {
    return JSON.parse(pdm.atributos_dt || '[]');
  } catch {
    return [];
  }
}

function scoreMaterial(material, pdm) {
  const pdmName = pdm.nome_valido || pdm.nome_pdm || '';
  const materialText = [
    material.descricao,
    material.texto_longo_original,
    material.tipo_material,
    material.fabricante,
    material.part_number,
    material.modelo,
    material.dimensao,
    material.material,
    material.aplicacao
  ].join(' ');

  const tokens = new Set(tokenize(materialText));
  const keywords = tokenize(pdm.palavra_chave || pdmName);
  const attributeText = parseAttributes(pdm).map((attr) => attr.attribute_name).join(' ');
  const pdmTokens = tokenize(`${pdmName} ${pdm.descricao_pdm || ''} ${pdm.tipo_material || ''} ${attributeText}`);
  const normalizedMaterial = normalize(materialText);
  const normalizedPdmName = normalize(pdmName);

  let points = 0;
  const reasons = [];

  if (String(pdm.id_pdm) === '1') {
    return { score: -1, confidence: 0, reasons: ['PDM reservado para itens sem padrao'] };
  }

  if (normalizedPdmName && normalizedMaterial.includes(normalizedPdmName)) {
    points += 95;
    reasons.push('correspondencia direta com Nome Valido');
  }

  for (const keyword of keywords) {
    if (tokens.has(keyword)) {
      points += 16;
      reasons.push(`termo tecnico ${keyword}`);
    }
  }

  for (const term of pdmTokens) {
    if (tokens.has(term)) points += 10;
  }

  const matchedAttributes = parseAttributes(pdm)
    .map((attr) => normalize(attr.attribute_name))
    .filter((attrName) => attrName && normalizedMaterial.includes(attrName));
  if (matchedAttributes.length) {
    points += Math.min(matchedAttributes.length * 8, 32);
    reasons.push(`${matchedAttributes.length} atributo(s) DT encontrado(s)`);
  }

  if (normalize(material.tipo_material) && normalize(material.tipo_material) === normalize(pdm.tipo_material)) {
    points += 12;
    reasons.push('tipo de material compativel');
  }

  const firstPdmTerm = normalizedPdmName.split(' ')[0];
  if (firstPdmTerm && normalizedMaterial.includes(firstPdmTerm)) {
    points += 14;
    reasons.push('termo principal do PDM encontrado no material');
  }

  return { score: points, confidence: Math.min(points, 98), reasons };
}

export async function suggestForMaterial(material) {
  const pdms = await db.prepare('SELECT * FROM pdms').all();
  const fallbackPdm = pdms.find((pdm) => String(pdm.id_pdm) === '1');
  let best = null;

  for (const pdm of pdms) {
    const result = scoreMaterial(material, pdm);
    if (!best || result.score > best.score) best = { ...pdm, ...result };
  }

  const pdm = best && best.score >= 25 ? best : fallbackPdm || null;
  const confidence = pdm && String(pdm.id_pdm) !== '1' ? pdm.confidence : 0;
  let status = 'REVISAR';
  if (String(pdm?.id_pdm) !== '1' && confidence >= 72) status = 'OK';
  else if (String(pdm?.id_pdm) !== '1' && confidence >= 45) status = 'VALIDAR';

  const finalTexts = generateFinalTexts(material, pdm);
  if (finalTexts.hasMissingInfo && status === 'OK') status = 'VALIDAR';
  if (!pdm || String(pdm.id_pdm) === '1') status = 'REVISAR';

  return {
    suggested_pdm_id: pdm?.id_pdm || '',
    suggested_pdm_name: pdm?.nome_valido || pdm?.nome_pdm || '',
    confidence,
    suggestion_reason: pdm && String(pdm.id_pdm) !== '1'
      ? pdm.reasons.slice(0, 4).join('; ')
      : 'Nenhum PDM razoavel encontrado; usado (NAO-PADRONIZADO)',
    status,
    ...finalTexts
  };
}
