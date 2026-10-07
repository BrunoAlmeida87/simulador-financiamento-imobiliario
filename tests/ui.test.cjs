// Teste de interface com Playwright (Chromium). Uso: node tests/ui.test.cjs
// Requer o pacote "playwright" e o Chromium instalados (veja .github/workflows/testes.yml).
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require('playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

let ok = 0, fail = 0;
const check = (nome, cond, info) => { if (cond){ ok++; console.log('  ✓ ' + nome); } else { fail++; console.log('  ✗ ' + nome + (info != null ? '  → ' + info : '')); } };
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');


// ---------- Layout responsivo: nada pode vazar, ser cortado ou exigir rolagem lateral ----------
const AUDIT = () => {
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('[hidden]') && e.offsetParent !== null; };
  const out = [];
  if (document.documentElement.scrollWidth > innerWidth) out.push('página +' + (document.documentElement.scrollWidth - innerWidth) + 'px');
  for (const c of [...document.querySelectorAll('.panel,.hero,.grp,.tile,.res,.stat,.opt,.ro,.vs>div,.card-share,.keys>div,.pcard,.ccard')].filter(vis)){
    const cr = c.getBoundingClientRect();
    for (const e of c.querySelectorAll('*')){
      if (!vis(e) || e.closest('.tbl-wrap') || e.closest('.tip') || e.closest('.chart')) continue;
      const r = e.getBoundingClientRect();
      if (r.right > cr.right + 1.5 || r.left < cr.left - 1.5){ out.push('fora do card: ' + (e.innerText || e.tagName).trim().slice(0, 30)); break; }
    }
  }
  for (const e of document.querySelectorAll('body *')){
    if (!vis(e) || e.closest('.tbl-wrap') || e.closest('.brand') || e.closest('svg') || ['CANVAS','INPUT','SELECT'].includes(e.tagName)) continue;
    const cs = getComputedStyle(e);
    if (/(hidden|clip)/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1 && !/\b(cbar|keys|bar)\b/.test(e.className)) out.push('cortado: ' + (e.innerText || '').trim().slice(0, 30));
  }
  for (const w of document.querySelectorAll('.tbl-wrap')) if (vis(w) && w.scrollWidth > w.clientWidth + 1) out.push('tabela rola: ' + (w.querySelector('table') || {}).id);
  const ov = (a, b) => { const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect(); return r1.width > 0 && r2.width > 0 && r1.left < r2.right - 1 && r2.left < r1.right - 1 && r1.top < r2.bottom - 1 && r2.top < r1.bottom - 1; };
  const bd = document.querySelector('.brand div');
  if (bd && getComputedStyle(bd).display !== 'none' && ov(bd, document.querySelector('#live'))) out.push('cabeçalho sobreposto');
  const sp = [...document.querySelectorAll('#bnav button span')];
  for (let i = 0; i + 1 < sp.length; i++) if (ov(sp[i], sp[i + 1])) out.push('barra inferior com rótulos encostados');
  return out;
};
const COMPLETO = { sistema:'COMP', indice:'ipca', segModo:'pct', mipPct:0.02, dfiPct:0.007, tarifa:25, renda:45000, avaliacao:3500, registro:12000,
  fgts:{ on:true, saldo:100000, mensal:1500, entrada:false, amortizar:true }, planta:{ on:true, meses:24, modo:'obra', incc:5, fluxo:true, sinal:50000, mensal:3000, balao:25000, balaoCada:6, chavesPag:80000 },
  pontuais:[{ mes:12, valor:100000 }], rec:{ valor:2000, cada:1, inicio:1, qtd:0 } };
async function auditarLayout(abrir){
  const VPS = [[320,640,1],[375,812,1],[768,1024,1],[1024,768,0],[1440,900,0]], problemas = [];
  for (const [w, h, mob] of VPS){
    const { ctx, pg } = await abrir({ viewport:{ width:w, height:h }, isMobile:!!mob, hasTouch:!!mob, deviceScaleFactor:1 });
    for (const estado of ['padrão', 'completo']){
      if (estado === 'completo'){
        await pg.evaluate(st => { localStorage.setItem('sfi_state_v1', JSON.stringify(st)); localStorage.setItem('sfi_cenarios_v1', JSON.stringify([1,2,3].map(i => ({ id:i, letra:'ABC'[i - 1], state:Object.assign({}, st, { entrada:300000 + i * 100000 }), res:{ valor:1600000, entrada:300000 + i * 100000, entradaPct:25, fin:1200000, banco:'Caixa', taxa:10.99, prazo:360, sistema:'SAC', p1:13805.76, last:3362.42, renda:46019.19, juros:1890272.62, total:3090272.62, n:360, extras:0, cet:10.99, indice:'IPCA' } })))); }, COMPLETO);
        await pg.reload(); await pg.waitForTimeout(400);
      }
      for (const t of ['resumo', 'graficos', 'comparar', 'planejar', 'tabela', 'dados']){
        if (!mob && t === 'dados') continue;
        await pg.evaluate(sel => { document.querySelector(sel).click(); scrollTo(0, 0); }, mob ? `#bnav [data-tab=${t}]` : `#topTabs [data-tab=${t}]`);
        await pg.waitForTimeout(200);
        if (t === 'comparar' && estado === 'completo') await pg.evaluate(() => { const b = document.querySelector('#btnCompCen'); if (b.innerText.includes('Comparar')) b.click(); });
        if (t === 'dados') await pg.evaluate(() => document.querySelectorAll('details.grp').forEach(d => d.open = true));
        await pg.waitForTimeout(120);
        const p = await pg.evaluate(AUDIT);
        if (p.length) problemas.push(`${w}px ${estado} ${t}: ${[...new Set(p)].slice(0, 3).join('; ')}`);
      }
    }
    await ctx.close();
  }
  return problemas;
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath:process.env.CHROMIUM_PATH } : {});
  const erros = [];
  async function abrir(opts, url){
    const ctx = await browser.newContext(Object.assign({ viewport:{ width:375, height:812 }, isMobile:true, hasTouch:true, deviceScaleFactor:2 }, opts || {}));
    const pg = await ctx.newPage();
    pg.on('pageerror', e => erros.push(String(e)));
    pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|fonts\.g/.test(m.text())) erros.push(m.text()); });
    await pg.goto(url || URL); await pg.waitForTimeout(500);
    return { ctx, pg };
  }
  const txt = async (pg, sel) => (await pg.innerText(sel)).replace(/\u00a0/g, ' ');
  const largura = async (pg, onde) => { const sw = await pg.evaluate(() => document.documentElement.scrollWidth); check('sem rolagem lateral: ' + onde, sw === 375, sw); };
  const tabs = ['resumo', 'graficos', 'comparar', 'planejar', 'tabela', 'dados'];

  for (const scheme of ['light', 'dark']){
    const { ctx, pg } = await abrir({ colorScheme:scheme });
    check(`[${scheme}] 1ª parcela SAC padrão`, (await txt(pg, '#liveVal')) === 'R$ 13.805,76', await txt(pg, '#liveVal'));
    for (const t of tabs){
      await pg.click(`#bnav [data-tab=${t}]`); await pg.waitForTimeout(250);
      const sw = await pg.evaluate(() => document.documentElement.scrollWidth);
      check(`[${scheme}] aba ${t} sem rolagem lateral`, sw === 375, sw);
    }
    await ctx.close();
  }

  const { ctx, pg } = await abrir();
  // CET sem custos = taxa de juros
  check('CET sem custos = 10,99% a.a.', (await txt(pg, '#tiles')).includes('10,99% a.a.'));
  // Glossário
  await pg.click('#tiles .q'); await pg.waitForTimeout(100);
  check('glossário abre ao tocar no "?"', await pg.isVisible('#pop') && (await txt(pg, '#popT')).includes('CET'));
  await pg.click('#popClose');
  // Máscara: os pontos de milhar aparecem enquanto digita
  await pg.click('#bnav [data-tab=dados]');
  await pg.fill('#valor', '');
  const passos = [];
  for (const ch of '1600000'){ await pg.locator('#valor').pressSequentially(ch); passos.push(await pg.inputValue('#valor')); }
  check('máscara: pontos aparecem enquanto digita', passos.join(' ') === '1 16 160 1.600 16.000 160.000 1.600.000', passos.join(' '));
  await pg.waitForTimeout(150);
  check('máscara: o valor digitado já vale no cálculo', (await txt(pg, '#liveVal')) === 'R$ 13.805,76', await txt(pg, '#liveVal'));
  for (let i = 0; i < 3; i++) await pg.keyboard.press('Backspace');
  const aposApagar = await pg.inputValue('#valor');
  await pg.evaluate(() => document.getElementById('valor').setSelectionRange(2, 2));   // cursor logo depois do ponto: "1.|600"
  await pg.keyboard.press('Backspace');
  const sobrePonto = await pg.inputValue('#valor');
  await pg.keyboard.press('End'); await pg.locator('#valor').pressSequentially('.5');
  const centavos = await pg.inputValue('#valor');
  check('máscara: apagar, apagar sobre o ponto e centavos', aposApagar === '1.600' && sobrePonto === '600' && centavos === '600,5', [aposApagar, sobrePonto, centavos].join(' | '));
  await pg.evaluate(() => document.getElementById('valor').setSelectionRange(0, 0));
  await pg.locator('#valor').pressSequentially('1');
  check('máscara: cursor fica no lugar ao editar no meio', (await pg.inputValue('#valor')) === '1.600,5' && (await pg.evaluate(() => document.getElementById('valor').selectionStart)) === 1);
  await pg.fill('#valor', '1600000'); await pg.locator('#valor').blur(); await pg.waitForTimeout(150);
  check('máscara: campo formatado também no preenchimento direto', (await pg.inputValue('#valor')) === '1.600.000' && (await txt(pg, '#liveVal')) === 'R$ 13.805,76');

  // Dados: seguros em percentual
  await pg.click('#bnav [data-tab=dados]');
  await pg.evaluate(() => document.querySelectorAll('details.grp').forEach(d => d.open = true));
  await pg.fill('#mipPct', '0,02'); await pg.waitForTimeout(150);
  check('MIP 0,02% do saldo soma R$ 240 na 1ª parcela', (await txt(pg, '#liveVal')) === 'R$ 14.045,76', await txt(pg, '#liveVal'));
  await pg.fill('#mipPct', '0'); await pg.waitForTimeout(100);
  // IPCA
  await pg.click('#indiceSeg [data-v=ipca]'); await pg.waitForTimeout(150);
  check('correção pelo IPCA ativa', (await txt(pg, '#trTag')) === 'IPCA' && (await pg.inputValue('#idxAA')) === '4');
  await pg.click('#indiceSeg [data-v=nenhum]'); await pg.waitForTimeout(100);
  // FGTS
  await pg.check('#fgtsOn'); await pg.fill('#fgtsSaldo', '100000'); await pg.fill('#fgtsMensal', '1000'); await pg.waitForTimeout(200);
  await pg.click('#bnav [data-tab=resumo]'); await pg.waitForTimeout(150);
  await largura(pg, 'resumo com FGTS');
  check('FGTS gera amortizações e aparece no resumo', await pg.isVisible('#extrasRes') && (await txt(pg, '#extrasResTitle')).includes('FGTS'), await txt(pg, '#extrasResTitle'));
  await pg.click('#bnav [data-tab=dados]'); await pg.uncheck('#fgtsOn'); await pg.waitForTimeout(100);
  // Planta
  await pg.check('#plantaOn'); await pg.waitForTimeout(150);
  await pg.click('#bnav [data-tab=resumo]'); await pg.waitForTimeout(150);
  check('imóvel na planta mostra a fase de obra', await pg.isVisible('#obraRes') && (await txt(pg, '#obraBody')).includes('INCC'));
  await pg.click('#bnav [data-tab=dados]'); await pg.click('#plantaModoSeg [data-v=obra]'); await pg.waitForTimeout(150);
  await pg.click('#bnav [data-tab=resumo]'); await pg.waitForTimeout(150);
  check('juros de obra calculados', (await txt(pg, '#obraBody')).includes('juros de obra'));
  await largura(pg, 'resumo com obra');
  // Pagamentos à construtora (comprar na planta e financiar nas chaves)
  await pg.click('#bnav [data-tab=dados]'); await pg.click('#plantaModoSeg [data-v=chaves]'); await pg.waitForTimeout(150);
  const antes = await txt(pg, '#liveVal');
  await pg.check('#plantaFluxo'); await pg.waitForTimeout(150);
  check('construtora: ao ligar, distribui a entrada atual sem mudar o resultado', (await pg.inputValue('#entrada')) === '400.000' && await pg.isDisabled('#entrada') && (await txt(pg, '#liveVal')) === antes,
    await pg.inputValue('#entrada') + ' ' + antes + ' → ' + await txt(pg, '#liveVal'));
  for (const [id, v] of [['plantaSinal', '50000'], ['plantaMensal', '5000'], ['plantaBalao', '30000'], ['plantaBalaoCada', '6'], ['plantaChavesPag', '100000']]){ await pg.fill('#' + id, v); }
  await pg.waitForTimeout(200);
  const fM = Math.pow(1.05, 1 / 12); let pago = 50000;
  for (let j = 1; j <= 24; j++) pago += (5000 + (j % 6 === 0 ? 30000 : 0) + (j === 24 ? 100000 : 0)) * Math.pow(fM, j);
  const fmt = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const finChaves = fmt(1210000 * Math.pow(1.05, 2));
  check('construtora: entrada = soma do contrato (50 mil + 24 × 5 mil + 4 × 30 mil + 100 mil)', (await pg.inputValue('#entrada')) === '390.000', await pg.inputValue('#entrada'));
  await pg.click('#bnav [data-tab=resumo]'); await pg.waitForTimeout(200);
  const ob = await txt(pg, '#obraRes');
  check('construtora: total pago com INCC e saldo financiado nas chaves', ob.includes(fmt(pago)) && ob.includes(finChaves) && await pg.isVisible('#cvObra'), fmt(pago) + ' / ' + finChaves);
  check('construtora: frase do resumo cita o pagamento à construtora', (await txt(pg, '#heroSub')).includes('à construtora'));
  await largura(pg, 'resumo com pagamentos à construtora');
  await pg.click('#bnav [data-tab=dados]'); await pg.uncheck('#plantaFluxo'); await pg.uncheck('#plantaOn'); await pg.waitForTimeout(100);
  check('construtora: ao desligar, a entrada volta a ser editável', !(await pg.isDisabled('#entrada')));
  await pg.fill('#entrada', '400000'); await pg.waitForTimeout(150);
  // PRICE com TR: a parcela sobe e o resumo explica
  await pg.click('#sistemaSeg [data-v=PRICE]'); await pg.click('#indiceSeg [data-v=tr]'); await pg.waitForTimeout(200);
  await pg.click('#bnav [data-tab=resumo]'); await pg.waitForTimeout(150);
  check('PRICE com TR explica que a parcela sobe e mostra a parcela sem correção', /Sobe com a correção do saldo pela TR.*sem correção, ficaria em torno de R\$ 10\.952,14/.test(await txt(pg, '#heroSub')), await txt(pg, '#heroSub'));
  await pg.click('#bnav [data-tab=dados]'); await pg.click('#sistemaSeg [data-v=SAC]'); await pg.click('#indiceSeg [data-v=nenhum]'); await pg.waitForTimeout(150);
  // Planejar
  await pg.click('#bnav [data-tab=planejar]'); await pg.waitForTimeout(250);
  const meta = await txt(pg, '#metaBody');
  check('meta de quitação calcula valor mensal', meta.includes('por mês'), meta.slice(0, 80));
  check('amortizar ou investir com ponto de equilíbrio', (await txt(pg, '#investBody')).includes('Ponto de equilíbrio'));
  check('comprar ou alugar', (await txt(pg, '#alugaBody')).includes('patrimônio'));
  check('valores de hoje', (await txt(pg, '#hojeBody')).includes('valores de hoje') || (await txt(pg, '#hojeBody')).includes('vale hoje'));
  check('portabilidade', (await txt(pg, '#portBody')).includes('Economia de'));
  await largura(pg, 'planejar');
  await pg.click('#btnMetaAplicar'); await pg.waitForTimeout(200);
  await pg.click('#bnav [data-tab=resumo]'); await pg.waitForTimeout(150);
  const quit = await txt(pg, '#tiles');
  const anos = +(/(\d+) anos/.exec(quit.split('Quitação')[1] || '') || [0, 99])[1];
  check('aplicar a meta quita em até 15 anos', anos <= 15, quit.split('Quitação')[1]);
  // Relatório
  await pg.click('#btnGerar'); await pg.waitForTimeout(1200);
  const fr = pg.frameLocator('#relFrame');
  const imgs = await fr.locator('img').count();
  const corpo = await fr.locator('body').innerText();
  check('relatório com 6 gráficos, CET e planejamento', imgs >= 6 && corpo.includes('CET') && corpo.includes('Planejamento'), imgs);
  await pg.click('#relClose');
  // Cenários: importar
  const tmp = path.join(os.tmpdir(), 'cen-teste.json');
  fs.writeFileSync(tmp, JSON.stringify({ cenarios:[{ letra:'A', state:{ valor:1000000, entrada:300000 } }, { letra:'B', state:{ valor:800000, entrada:200000, sistema:'<img src=x onerror=alert(1)>' } }] }));
  await pg.click('#bnav [data-tab=comparar]');
  await pg.setInputFiles('#impFile', tmp); await pg.waitForTimeout(300);
  await pg.click('#btnCompCen'); await pg.waitForTimeout(150); await largura(pg, 'comparar cenários');
  check('importa cenários de arquivo', (await txt(pg, '#cenBadge')) === '2 de 4', await txt(pg, '#cenBadge'));
  check('importação ignora valores inválidos', !(await pg.innerHTML('#cenList')).includes('<img'));
  await ctx.close();

  // Link com a simulação
  const l = await abrir({}, URL + '#s=' + b64({ valor:900000, entrada:300000 }));
  check('link abre a simulação (R$ 600 mil, SAC 360)', (await txt(l.pg, '#liveVal')) === 'R$ 6.902,88', await txt(l.pg, '#liveVal'));
  check('link limpo da barra de endereço', !(await l.pg.evaluate(() => location.hash)));
  await l.ctx.close();

  // Taxas do Banco Central (taxas.json servido por HTTP, como no GitHub Pages)
  const http = require('http'), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sim-'));
  ['index.html', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable.png'].forEach(f => fs.copyFileSync(path.resolve(__dirname, '..', f), path.join(dir, f)));
  fs.writeFileSync(path.join(dir, 'taxas.json'), JSON.stringify({ mercado:{ periodo:'ago/2026', bancos:{ caixa:12.12, itau:12.06 } } }));
  const srv = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!f.startsWith(dir) || !fs.existsSync(f)){ r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type':f.endsWith('.json') || f.endsWith('.webmanifest') ? 'application/json' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8' }); fs.createReadStream(f).pipe(r); });
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const t = await abrir({}, `http://127.0.0.1:${srv.address().port}/`);
  await t.pg.waitForTimeout(600);
  const i = Math.pow(1.1212, 1 / 12) - 1, esperado = 'R$ ' + (1200000 / 360 + 1200000 * i).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  check('taxa da Caixa vem do Banco Central (12,12%)', (await txt(t.pg, '#liveVal')) === esperado, (await txt(t.pg, '#liveVal')) + ' ≠ ' + esperado);
  await t.pg.click('#bnav [data-tab=dados]');
  check('chips e aviso mostram a fonte e o mês', (await txt(t.pg, '#bankChips')).includes('12,06%') && (await txt(t.pg, '#taxasNota')).includes('ago/2026'));
  await t.pg.fill('#taxa', '9,5'); await t.pg.waitForTimeout(150);
  check('taxa digitada não é sobrescrita', (await txt(t.pg, '#liveVal')) !== esperado);
  await t.ctx.close(); srv.close();

  // Layout em 5 tamanhos de tela, 6 abas, dados simples e completos
  const prob = await auditarLayout(abrir);
  check('layout sem vazamentos, cortes ou tabelas que exigem rolagem (5 telas × 6 abas × 2 cenários)', prob.length === 0, prob.slice(0, 6).join(' | '));

  // Relatório impresso em A4: nenhuma tabela ou gráfico passa da largura da página
  { const { ctx, pg } = await abrir({ viewport:{ width:1280, height:900 }, isMobile:false, hasTouch:false });
    await pg.evaluate(st => localStorage.setItem('sfi_state_v1', JSON.stringify(st)), COMPLETO); await pg.reload(); await pg.waitForTimeout(400);
    await pg.click('#btnRelTop'); await pg.waitForTimeout(1200);
    const html = await pg.evaluate(() => document.getElementById('relFrame').srcdoc);
    const r = await ctx.newPage(); await r.setContent(html); await r.emulateMedia({ media:'print' }); await r.setViewportSize({ width:718, height:1000 });
    const fora = await r.evaluate(() => [...document.querySelectorAll('.wide,table,img,section')].filter(e => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length);
    check('relatório cabe na largura do A4 (sem tabelas cortadas no PDF)', fora === 0, fora);
    await ctx.close(); }

  // Desktop
  const d = await abrir({ viewport:{ width:1440, height:900 }, isMobile:false, hasTouch:false });
  for (const t of ['resumo', 'graficos', 'comparar', 'planejar', 'tabela']){ await d.pg.click(`#topTabs [data-tab=${t}]`); await d.pg.waitForTimeout(200); }
  check('desktop sem rolagem lateral', (await d.pg.evaluate(() => document.documentElement.scrollWidth)) === 1440);
  await d.ctx.close();

  check('nenhum erro de JavaScript', erros.length === 0, erros.join(' | '));
  await browser.close();
  console.log(`\n${ok} ok, ${fail} falha(s)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
