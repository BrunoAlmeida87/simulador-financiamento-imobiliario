// Atualiza taxas.json com as taxas médias praticadas pelos bancos no financiamento imobiliário,
// a partir dos dados abertos do Banco Central (API Olinda, "Taxas de juros de operações de crédito").
// Nas modalidades pós-fixadas, o BC divulga a taxa SEM o indexador (TR), igual ao campo de taxa do simulador.
// Usa a série semanal (média de 5 dias úteis) e, se não houver, a mensal.
// Uso: node .github/scripts/atualizar-taxas.mjs   (Node 20+, sem dependências)
import fs from 'node:fs';

const BASE = 'https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/';
const BANCOS = {
  caixa:     { cnpj:'00360305', re:/caixa/i },
  bb:        { cnpj:'00000000', re:/(banco|bco)\.? do brasil/i },
  itau:      { cnpj:'60701190', re:/ita[uú]/i },
  bradesco:  { cnpj:'60746948', re:/bradesco/i },
  santander: { cnpj:'90400888', re:/santander/i }
};
const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const diag = [];
const log = (...a) => { const t = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(t); diag.push(t.slice(0, 400)); };

/* Converte período em número ordenável (AAAAMMDD) e rótulo amigável. */
function periodo(v){
  const s = String(v).trim();
  let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return { ord:+(m[1] + m[2] + m[3]), rot:`${m[3]}/${m[2]}/${m[1]}` };
  if ((m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s))) return { ord:+(m[3] + m[2] + m[1]), rot:s.slice(0, 10) };
  if ((m = /^(\d{4})-?(\d{2})$/.exec(s))) return { ord:+(m[1] + m[2] + '01'), rot:`${MESES[+m[2] - 1]}/${m[1]}` };
  if ((m = /^([A-Za-zçÇ]{3})[-\/ ](\d{4})$/.exec(s))){ const i = MESES.indexOf(m[1].toLowerCase()); if (i >= 0) return { ord:+(m[2] + String(i + 1).padStart(2, '0') + '01'), rot:`${MESES[i]}/${m[2]}` }; }
  return { ord:0, rot:s };
}
async function get(recurso, qs){
  const url = BASE + recurso + '?$format=json&' + qs;
  console.log('GET', url);
  const r = await fetch(url, { headers:{ accept:'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return (await r.json()).value || [];
}
const findKey = (obj, ...res) => Object.keys(obj).find(k => res.every(re => re.test(k)));

async function serie(recurso, tipo){
  const ex = (await get(recurso, '$top=1'))[0];
  if (!ex) throw new Error('sem dados');
  const K = {
    per: tipo === 'semanal' ? (findKey(ex, /inicio/i) || findKey(ex, /periodo/i)) : (findKey(ex, /^mes$/i) || findKey(ex, /anomes/i) || findKey(ex, /mes/i)),
    fim: findKey(ex, /fim/i), mod: findKey(ex, /modalidade/i), inst: findKey(ex, /institui/i),
    aa: findKey(ex, /taxa/i, /ano/i), cnpj: findKey(ex, /cnpj/i), seg: findKey(ex, /segmento/i)
  };
  log(tipo, 'campos', Object.keys(ex).join(','), 'exemplo', ex[K.per], ex[K.mod]);
  let linhas = [];
  for (const q of [`$filter=contains(${K.mod},'imobili')&$orderby=${K.per} desc&$top=4000`,
                   `$filter=substringof('imobili',${K.mod})&$orderby=${K.per} desc&$top=4000`]){
    try { linhas = (await get(recurso, q)).filter(r => /imobili/i.test(r[K.mod])); if (linhas.length) break; }
    catch(e){ log(tipo, 'consulta falhou', e.message); }
  }
  if (K.seg) linhas = linhas.filter(r => !r[K.seg] || /f[ií]sica/i.test(r[K.seg]));
  log(tipo, 'linhas', linhas.length);
  const mods = [...new Set(linhas.map(r => r[K.mod]))];
  log(tipo, 'modalidades', mods);
  const res = {};
  for (const [id, re] of Object.entries({ sfh:[/regulad/i, /\bTR\b/], sfi:[/mercado/i, /\bTR\b/] })){
    const mod = mods.find(m => re.every(x => x.test(m))); if (!mod) continue;
    const doMod = linhas.filter(r => r[K.mod] === mod);
    const pers = [...new Set(doMod.map(r => String(r[K.per])))].sort((a, b) => periodo(b).ord - periodo(a).ord);
    log(tipo, id, 'períodos mais recentes', pers.slice(0, 4));
    for (const p of pers.slice(0, 4)){
      const doPer = doMod.filter(r => String(r[K.per]) === p), bancos = {};
      for (const [b, def] of Object.entries(BANCOS)){
        const r = doPer.find(x => (K.cnpj && String(x[K.cnpj]).padStart(8, '0') === def.cnpj) || def.re.test(x[K.inst]));
        const v = r ? Number(String(r[K.aa]).replace(',', '.')) : NaN;
        if (isFinite(v) && v > 0 && v < 40) bancos[b] = Math.round(v * 100) / 100;
      }
      log(tipo, id, p, bancos);
      if (Object.keys(bancos).length >= 3){
        const ini = periodo(p), fim = K.fim ? periodo(doPer[0][K.fim]) : null;
        res[id] = { modalidade:mod, serie:tipo, periodo:tipo === 'semanal' && fim ? `${ini.rot} a ${fim.rot}` : ini.rot, ord:ini.ord, bancos };
        break;
      }
    }
  }
  return res;
}

async function main(){
  const sets = [];
  for (const [rec, tipo] of [['TaxasJurosDiariaPorInicioPeriodo', 'semanal'], ['TaxasJurosMensalPorMes', 'mensal']]){
    try { sets.push(await serie(rec, tipo)); } catch(e){ log(tipo, 'falhou', e.message); }
  }
  const out = {
    fonte:'Banco Central do Brasil — taxas médias de juros por instituição financeira',
    url:'https://www.bcb.gov.br/estatisticas/reporttxjuros',
    nota:'Taxa média praticada pelo banco no período, sem a TR (pós-fixado referenciado em TR), pessoa física.',
    gerado:new Date().toISOString().slice(0, 10)
  };
  for (const id of ['sfh', 'sfi']){
    const cands = sets.map(s => s[id]).filter(Boolean).sort((a, b) => b.ord - a.ord);
    if (cands.length){ const { ord, ...x } = cands[0]; out[id] = x; }
  }
  if (process.env.TAXAS_DIAG) out._diag = diag;
  if (!out.sfh && !out.sfi){ console.error('ERRO: nenhuma taxa encontrada; taxas.json não foi alterado'); if (process.env.TAXAS_DIAG) fs.writeFileSync('taxas.json', JSON.stringify(out, null, 2) + '\n'); process.exit(process.env.TAXAS_DIAG ? 0 : 1); }
  fs.writeFileSync('taxas.json', JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
}
main().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
