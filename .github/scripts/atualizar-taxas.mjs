// Atualiza taxas.json com as taxas médias praticadas pelos bancos no financiamento imobiliário,
// a partir dos dados abertos do Banco Central (API Olinda, "Taxas de juros de operações de crédito").
// Nas modalidades pós-fixadas, o BC divulga a taxa SEM o indexador (TR/IPCA), igual ao campo de taxa do simulador.
// Uso: node .github/scripts/atualizar-taxas.mjs   (Node 20+, sem dependências)
import fs from 'node:fs';

const BASE = 'https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/';
const RECURSO = 'TaxasJurosMensalPorMes';
const BANCOS = {
  caixa:     { cnpj:'00360305', re:/caixa/i },
  bb:        { cnpj:'00000000', re:/(banco|bco)\.? do brasil/i },
  itau:      { cnpj:'60701190', re:/ita[uú]/i },
  bradesco:  { cnpj:'60746948', re:/bradesco/i },
  santander: { cnpj:'90400888', re:/santander/i }
};
const log = (...a) => console.log(...a);

async function get(qs){
  const url = BASE + RECURSO + '?$format=json&' + qs;
  log('GET', url);
  const r = await fetch(url, { headers:{ accept:'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const j = await r.json();
  return j.value || [];
}
const findKey = (obj, ...res) => Object.keys(obj).find(k => res.every(re => re.test(k)));

async function main(){
  const amostra = await get('$top=1');
  if (!amostra.length) throw new Error('API sem dados');
  const ex = amostra[0];
  log('Campos:', JSON.stringify(ex));
  const K = {
    mes: findKey(ex, /^mes$/i) || findKey(ex, /anomes/i) || findKey(ex, /mes/i),
    mod: findKey(ex, /modalidade/i),
    inst: findKey(ex, /institui/i),
    aa: findKey(ex, /taxa/i, /ano/i),
    cnpj: findKey(ex, /cnpj/i),
    seg: findKey(ex, /segmento/i)
  };
  log('Chaves:', JSON.stringify(K));
  if (!K.mod || !K.inst || !K.aa || !K.mes) throw new Error('Campos não reconhecidos');

  let linhas = [];
  const tentativas = [
    `$filter=contains(${K.mod},'imobili')&$orderby=${K.mes} desc&$top=5000`,
    `$filter=substringof('imobili',${K.mod})&$orderby=${K.mes} desc&$top=5000`,
    `$orderby=${K.mes} desc&$top=60000`
  ];
  for (const q of tentativas){
    try { linhas = (await get(q)).filter(r => /imobili/i.test(r[K.mod])); log('→', linhas.length, 'linhas de financiamento imobiliário'); if (linhas.length) break; }
    catch(e){ log('falhou:', e.message); }
  }
  if (!linhas.length) throw new Error('Nenhuma linha de financiamento imobiliário encontrada');
  if (K.seg) linhas = linhas.filter(r => !r[K.seg] || /f[ií]sica/i.test(r[K.seg]));

  const mods = [...new Set(linhas.map(r => r[K.mod]))];
  log('Modalidades:', mods);
  const escolher = re => mods.find(m => re.every(x => x.test(m)));
  const conjuntos = {
    sfh: escolher([/regulad/i, /\bTR\b/]),
    sfi: escolher([/mercado/i, /\bTR\b/])
  };
  log('Escolhidas:', conjuntos);

  const out = {
    fonte:'Banco Central do Brasil — taxas médias de juros por instituição financeira',
    url:'https://www.bcb.gov.br/estatisticas/reporttxjuros',
    nota:'Taxa média praticada pelo banco no mês, sem a TR (pós-fixado referenciado em TR), pessoa física.',
    gerado:new Date().toISOString().slice(0, 10)
  };
  let total = 0;
  for (const [id, mod] of Object.entries(conjuntos)){
    if (!mod) continue;
    const doMod = linhas.filter(r => r[K.mod] === mod);
    const meses = [...new Set(doMod.map(r => String(r[K.mes])))].sort().reverse();
    for (const mes of meses.slice(0, 3)){
      const doMes = doMod.filter(r => String(r[K.mes]) === mes), bancos = {};
      for (const [b, def] of Object.entries(BANCOS)){
        const r = doMes.find(x => (K.cnpj && String(x[K.cnpj]).padStart(8, '0') === def.cnpj) || def.re.test(x[K.inst]));
        const v = r ? Number(String(r[K.aa]).replace(',', '.')) : NaN;
        if (isFinite(v) && v > 0 && v < 40) bancos[b] = Math.round(v * 100) / 100;
      }
      log(id, mes, JSON.stringify(bancos));
      if (Object.keys(bancos).length >= 3){ out[id] = { modalidade:mod, mes, bancos }; total += Object.keys(bancos).length; break; }
    }
  }
  if (!total) throw new Error('Nenhuma taxa de banco encontrada; taxas.json não foi alterado');
  fs.writeFileSync('taxas.json', JSON.stringify(out, null, 2) + '\n');
  log('taxas.json gravado:\n' + JSON.stringify(out, null, 2));
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
