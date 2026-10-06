// Testes do motor de cálculo (extrai o bloco ENGINE do index.html). Uso: node tests/engine.test.cjs
const fs = require('fs'), path = require('path'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.split('// ENGINE-START')[1].split('// ENGINE-END')[0].replace(/^.*\n/, '');
const E = new Function(src + '; return { taxaMensal, taxaAnual, pmt, buildExtras, simular };')();
const { taxaMensal, taxaAnual, pmt, buildExtras, simular } = E;

let ok = 0, fail = 0;
function t(nome, fn){ try { fn(); ok++; console.log('  ✓ ' + nome); } catch(e){ fail++; console.log('  ✗ ' + nome + '\n    ' + e.message); } }
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= (tol == null ? 0.005 : tol), `${msg || ''} esperado ${b}, obtido ${a}`);

const iM = taxaMensal(0.1099);
const base = { pv:1200000, iM, n:360, trM:0, seg:0, tarifa:0, extras:[], modo:'prazo' };

t('taxa mensal equivalente (não divide por 12)', () => { near(iM * 100, 0.8727020, 1e-6); near(taxaAnual(iM), 0.1099, 1e-12); });
t('SAC: 1ª, 5 anos, meio, última', () => {
  const s = simular(Object.assign({}, base, { sistema:'SAC' }));
  near(s.p1, 13805.76); near(s.p61, 12060.35); near(s.pMeio, 8598.64); near(s.last, 3362.42);
});
t('SAC: juros totais pela fórmula fechada', () => {
  const s = simular(Object.assign({}, base, { sistema:'SAC' }));
  near(s.juros, 1890272.62); near(s.juros, iM * (1200000 / 360) * 360 * 361 / 2, 0.01);
});
t('PRICE: parcela constante = PMT', () => {
  const s = simular(Object.assign({}, base, { sistema:'PRICE' }));
  near(s.p1, 10952.14); near(s.last, 10952.14); near(s.p1, pmt(1200000, iM, 360), 1e-6); near(s.juros, 2742770.28);
});
t('1ª parcela em 240/300/420 meses', () => {
  [[240, 15472.42, 11958.34], [300, 14472.42, 11306.56], [420, 13329.57, 10752.04]].forEach(([n, a, b]) => {
    near(simular(Object.assign({}, base, { n, sistema:'SAC' })).p1, a, 0.005, 'SAC ' + n);
    near(simular(Object.assign({}, base, { n, sistema:'PRICE' })).p1, b, 0.005, 'PRICE ' + n);
  });
});
t('amortizações extras reduzindo o prazo (referência)', () => {
  const ex = buildExtras(360, { on:true, pontuais:[{ mes:12, valor:100000 }], rec:{ valor:20000, cada:12, inicio:24, qtd:0 } });
  const s = simular(Object.assign({}, base, { sistema:'SAC', extras:ex }));
  assert.strictEqual(s.n, 228); near(s.juros, 1125960.18);
});
t('fechamento ≈ 0 em todos os cenários (amortizado + extras = financiado + correção)', () => {
  const ex = buildExtras(360, { on:true, pontuais:[{ mes:7, valor:80000 }], rec:{ valor:3000, cada:1, inicio:1, qtd:0 } });
  ['SAC', 'PRICE'].forEach(sistema => ['prazo', 'parcela'].forEach(modo => [0, taxaMensal(0.015), taxaMensal(0.045)].forEach(trM => {
    const s = simular(Object.assign({}, base, { sistema, modo, trM, extras:ex, seg:40, segSaldo:0.0002, tarifa:25 }));
    near(s.fechamento, 0, 1e-4, `${sistema}/${modo}/tr=${trM}`);
    assert.ok(s.rows[s.rows.length - 1].saldo === 0, 'saldo final zero');
  })));
});
t('seguro proporcional ao saldo (MIP %)', () => {
  const s = simular(Object.assign({}, base, { sistema:'SAC', seg:50, segSaldo:0.0002 }));
  near(s.rows[0].seg, 50 + 1200000 * 0.0002); near(s.rows[1].seg, 50 + (1200000 - 1200000 / 360) * 0.0002, 1e-6);
  near(s.p1, 13805.76 + 290);
});
t('taxa zero e prazo de 1 mês', () => {
  near(simular(Object.assign({}, base, { iM:0, sistema:'PRICE' })).p1, 3333.33);
  near(simular(Object.assign({}, base, { n:1, sistema:'SAC' })).p1, 1210472.42);
});
console.log(`\n${ok} ok, ${fail} falha(s)`);
process.exit(fail ? 1 : 0);
