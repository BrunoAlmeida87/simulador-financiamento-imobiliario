// Teste de interface com Playwright (Chromium). Uso: node tests/ui.test.cjs
// Requer o pacote "playwright" e o Chromium instalados (veja .github/workflows/testes.yml).
const path = require('path'), fs = require('fs'), os = require('os');
const { chromium } = require('playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

let ok = 0, fail = 0;
const check = (nome, cond, info) => { if (cond){ ok++; console.log('  ✓ ' + nome); } else { fail++; console.log('  ✗ ' + nome + (info != null ? '  → ' + info : '')); } };
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

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
  const txt = (pg, sel) => pg.innerText(sel);
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
  await pg.click('#bnav [data-tab=dados]'); await pg.uncheck('#plantaOn'); await pg.waitForTimeout(100);
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
