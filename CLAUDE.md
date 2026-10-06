# CLAUDE.md — Simulador de Financiamento Imobiliário

Contexto para a IA. Leia antes de alterar qualquer coisa neste repositório.

## O que é

Simulador de financiamento imobiliário brasileiro que responde a uma pergunta: **"Se eu comprar este imóvel, quanto vou pagar por mês?"**

- **Um único arquivo `index.html`** com todo o HTML, CSS e JavaScript. Não tem backend, build nem dependências locais.
- Para usar, basta abrir o arquivo no navegador. Também é publicado via GitHub Pages em https://brunoalmeida87.github.io/simulador-financiamento-imobiliario/
- **Mobile first**: a tela de referência tem 375px de largura. A partir de 1024px o layout vira 2 colunas (entradas fixas à esquerda, resultados à direita).
- Modo claro e escuro automáticos, via `prefers-color-scheme`.
- Interface, textos e formatação em **pt-BR** (`R$ 1.234.567,89`, `10,99%`).
- Autor/usuário: Bruno (Rio de Janeiro). Ele se comunica em português e prefere respostas diretas, tecnicamente precisas e com tabelas para números.

## Regras que não podem ser quebradas

1. **Arquivo único.** Todo o app fica em `index.html`; não separe CSS/JS e não adicione etapa de build. A única dependência externa é o `html2canvas` via CDN (cdnjs), carregado sob demanda só no botão "Salvar como imagem". Todo o resto precisa funcionar offline. **Exceção aprovada:** os arquivos do PWA (`manifest.webmanifest`, `sw.js`, `icon.svg`, `icon-*.png`) e os testes (`tests/`, `.github/workflows/`). O `index.html` precisa continuar funcionando sozinho, sem eles.
2. **Taxa mensal equivalente:** `i_m = (1 + i_a)^(1/12) − 1`. **Nunca** use `taxa anual / 12`.
3. **Precisão interna cheia.** Só arredonde na exibição.
4. **Não declare qual sistema (SAC/PRICE) é "melhor".** Apresente apenas os números.
5. **Taxas dos bancos, índices (TR, IPCA, INCC), rendimentos e regras do FGTS são referências editáveis**, não oficiais. Mantenha os avisos de que são estimativas.
8. **Linguagem simples para o usuário final.** Cada recurso novo deve caber em poucos campos, com uma frase-resultado clara e um "?" no glossário (`GLOSS`) quando houver termo técnico.
6. Mantenha o aviso legal do rodapé ("não representa proposta, aprovação ou oferta de crédito…").
7. O cálculo atualiza automaticamente a cada alteração. Não existe botão "Calcular" obrigatório.

## Estrutura do `index.html`

| Trecho | Conteúdo |
|---|---|
| `<style>` | Tokens em `:root` (claro) + bloco dark (`prefers-color-scheme` e `[data-theme]`); cores de série `--s-*`; `@media print` |
| `<header>` | Marca, valor da 1ª parcela ao vivo (`#live`) e botão Relatório |
| `<main>` | `#tab-dados` (entradas, em `<aside>`) e `.mainc` com as abas `#tab-resumo`, `#tab-graficos`, `#tab-comparar`, `#tab-planejar`, `#tab-tabela` |
| `<footer>` | Glossário (`#glossList`, gerado de `GLOSS`), botão Instalar app e aviso legal |
| `#relModal` / `#pop` | Pré-visualização do relatório em `<iframe srcdoc>` / popover do glossário |
| 1º `<script>` entre `// ENGINE-START` e `// ENGINE-END` | **Motor de cálculo puro**, sem DOM: `taxaMensal`, `taxaAnual`, `pmt`, `buildExtras`, `simular`, `resumir` |
| 2º `<script>` (IIFE) | Configuração, estado, formatação, motor de gráficos, renderização, relatório, abas, eventos |

### Design

- Identidade: azul-marinho como tinta (`--ink`/`--primary`), latão (`--brass`) só para destaques (pontos-chave da curva, número do cartão), fundo papel azulado. Fonte **Schibsted Grotesk** (Google Fonts) com números tabulares; sem internet, usa a fonte do sistema.
- **Navegação:** no celular (< 1024px) há uma aba visível por vez e barra inferior `.bnav` (Dados, Resumo, Gráficos, Comparar, Planejar, Tabela). No desktop, Dados fica fixo à esquerda e as outras abas aparecem no topo (`.tabs`). A aba atual é salva em `sfi_tab_v1`. Use `setTab(id)` e `applyTab()`.
- O destaque principal é o número da 1ª parcela (`moneyHTML`) com a curva de parcelas (`cvHero`). Os pontos em latão marcam 5 anos, meio e última, e batem com os itens marcados em `#heroKeys`.

### Gráficos (canvas puro, sem biblioteca)

- Motor: `drawChart(cv, spec, theme, hover, W, H, dpr)` com tipos `line`, `stack` (barras empilhadas), `hbar` e `donut`. Tooltip por toque/mouse, legenda automática para 2 ou mais séries.
- **Specs usam papéis de cor**, não hex (`'amort'`, `'juros'`, `'entrada'`, `'extra'`, `'tr'`, `'seg'`, `'custos'`, `'sac'`, `'price'`, `'buy'`, `'rent'`, `'base'`, `'main'`), resolvidos por `TH.light`/`TH.dark`. O mesmo spec desenha na tela e no relatório (`chartImage`, sempre claro).
- Paleta validada para daltonismo (claro e escuro). Mantenha os papéis: amortização = azul, juros = laranja, entrada/extras = verde-água, correção (TR/IPCA/INCC) = amarelo, seguros = magenta, custos de compra/PRICE = violeta, "sem extras" = cinza tracejado. `TH` e as variáveis `--s-*` do CSS devem ficar sincronizados.
- Gráficos registrados com `mount(id, specFn)`: `cvHero`, `cvEvo` (métrica em `evoMetric`), `cvAnual`, `cvPat` (quanto do imóvel é seu), `cvAcum` (cruzamento entre juros e amortização acumulados), `cvDonut`, `cvVS`, `cvPrazoP`, `cvPrazoJ`, `cvInvest`, `cvAluga`, `cvHoje`. Um `ResizeObserver` redesenha cada um quando a aba aparece.

### Relatório

`buildReport()` gera um HTML A4 independente (tema claro, gráficos em PNG embutidos). O modal oferece Imprimir/PDF, Baixar (.html) e Abrir em nova aba. Ao adicionar uma seção na tela, avalie incluí-la no relatório.

### Configuração (topo do 2º script) — os pontos editados com mais frequência

- `BANCOS` — presets `{ id, nome, taxa }` em % a.a. efetiva. `taxa: null` corresponde a "Personalizado".
- `FGTS_TETO` (R$ 2,25 mi, Conselho Curador do FGTS, nov/2025), `FGTS_INTERVALO` (24 meses entre usos), `FGTS_REND_AA` (3% a.a., sem a TR). **Confira periodicamente.**
- `PRAZOS_ANOS` (chips 10–35 anos), `PRAZOS_COMPARADOR` (240/300/360/420 meses), `ENTRADAS_EXTRA` (+50k/+100k/+200k), `MAX_CENARIOS` (4).
- `DEFAULTS` — dados iniciais de demonstração: imóvel R$ 1.600.000, entrada R$ 400.000, 10,99% a.a., 360 meses, SAC, comprometimento de renda de 30%, sem correção, seguros 0 (modo percentual), LTV máximo de 80%, ITBI de 3%, renda 0 (opcional), FGTS e planta desligados, e `plan` com os valores iniciais da aba Planejar.
- Chaves do localStorage: `sfi_state_v1` (último estado), `sfi_cenarios_v1` (até 4 cenários) e `sfi_tab_v1` (aba atual). Ao mudar o formato do estado, ajuste `DEFAULTS` e `normState()`. `normState` aceita só chaves conhecidas, com tipos válidos e enums da lista `ENUMS`: é a barreira de segurança para estado vindo de link, cenário importado ou localStorage. Estado antigo (`tr:true`, `mip`/`dfi` fixos) é migrado ali.

### Fluxo

`evento` → altera o objeto de estado `S` → `update()` (agrupa via requestAnimationFrame) → `run()` → `compute()` preenche `R` (`R.sac`, `R.price`, `R.main`, `R.base` = sem extras, `R.ann` = resumo anual, `R.cc` = custos da compra, `R.obra`, `R.cet`, `R.fgtsAmort`, `R.fgtsEntrada`; `R.plan` é preenchido em `renderPlan`) → funções `render*()` → `paintAll()` → salva `S` no localStorage.

Para simular variações, use `sim(overrides)`, por exemplo `sim({ prazo: 300, sistemaCalc: 'PRICE' })`. Overrides especiais de `params()`: `extrasVec` (vetor pronto de extras) e `noFgts` (sem FGTS). `R.base` = sem extras e sem FGTS.

### Camada de aplicação sobre o motor

- **Correção:** `S.indice` = `nenhum` | `tr` | `ipca` (`trAA`, `ipcaAA`). `idxOn()`, `idxNome()`, `idxAA()`.
- **Seguros:** `S.segModo` = `pct` (MIP % do saldo → `segSaldo`; DFI % do valor do imóvel → `seg` fixo) ou `fixo` (`mip` + `dfi` em R$).
- **FGTS** (`fgtsExtras`): só se `valor ≤ FGTS_TETO`. Se não for usado na entrada, o saldo atual amortiza na parcela 1; depois o acumulado (depósito mensal + 3% a.a.) a cada 24 meses. Os valores entram no vetor de extras, com o mesmo modo (prazo ou parcela).
- **Planta** (`obraCalc`): `chaves` corrige o valor a financiar pelo INCC por N meses (`pvEff`); `obra` cobra juros sobre a liberação linear do banco por N meses (`R.obra.juros`, somado em `totBanco`). A 1ª parcela (`S.inicio`) é a primeira depois das chaves.
- **CET** (`calcCET`): TIR mensal dos fluxos (`pv − avaliação` em t0; `total + extra` por mês), anualizada. Sem custos, CET = taxa de juros.
- **Planejar:** `planMeta` (bissecção do aporte mensal/anual para quitar em N anos; "Usar" grava em `S.rec`), `planInvest` (mesmo orçamento mensal nos dois caminhos; compara o patrimônio investido no fim e acha o ponto de equilíbrio, que deve ficar perto do CET), `planAluga` (patrimônio comprando: imóvel valorizado − saldo + investimentos; alugando: entrada + custos investidos + diferença mensal), `planHoje` (deflaciona parcelas e calcula o % da renda reajustada), `planPort` (refaz o restante do contrato a partir do saldo na parcela m com a nova taxa).

## Modelo financeiro (`simular(o)`)

Entrada: `{ pv, iM, n, sistema: 'SAC'|'PRICE', trM, seg, segSaldo, tarifa, extras[], modo: 'prazo'|'parcela' }`. `trM` é o índice de correção mensal (TR ou IPCA).

A cada mês `k`:
1. **TR:** `corr = saldo × trM`; o saldo é corrigido **antes** dos juros. A amortização base (SAC) e a PMT base (PRICE) também são corrigidas por `(1+trM)`.
2. `juros = saldo × iM`.
3. **SAC:** amortização = `PV/n`, constante (com TR, corrigida).
   **PRICE:** prestação = `PMT = PV·i(1+i)^n / ((1+i)^n − 1)`, constante (com TR, corrigida); amortização = PMT − juros.
4. Na última parcela, ou se a amortização passar do saldo, amortiza o saldo inteiro.
5. **Amortização extra** (`extras[k]`) é abatida do saldo **após** a parcela k.
   - `modo 'prazo'`: mantém amortização (SAC) ou prestação (PRICE) e o contrato termina antes.
   - `modo 'parcela'`: mantém o prazo e recalcula sobre o saldo e as parcelas restantes (`saldo/rem` no SAC, `pmt(saldo,i,rem)` no PRICE).
6. Seguros: `seg` fixo (R$/mês) + `segSaldo` × saldo do mês (MIP percentual). Tarifa fixa. Tudo somado ao total enquanto houver saldo.

Saída (`resumir`): `rows[]` com `{k, corr, juros, amort, prest, seg, tarifa, custos, total, extra, saldo}` e totais `juros, amort, extras, corr, custos, prest, totalPago` (= prestações + custos + extras), além de `p1, p13, p61, pMeio, last` e `n` (parcelas efetivamente pagas).
**Invariante:** `fechamento = (amort + extras) − (pv + corr) ≈ 0`.

`buildExtras(n, {on, pontuais:[{mes,valor}], rec:{valor,cada,inicio,qtd}})` gera o vetor de extras. `qtd = 0` significa recorrência até quitar.

## Valores de referência para regressão

PV R$ 1.200.000, 10,99% a.a., 360 meses, sem TR e sem seguros:

| Verificação | Esperado |
|---|---|
| Taxa mensal | 0,8727020% a.m. |
| SAC — 1ª / após 5 anos / meio (nº 180) / última | R$ 13.805,76 / 12.060,35 / 8.598,64 / 3.362,42 |
| SAC — juros totais | R$ 1.890.272,62 (= `i·(PV/n)·n(n+1)/2`) |
| PRICE — parcela | R$ 10.952,14 (constante) |
| PRICE — juros totais | R$ 2.742.770,28 |
| 1ª parcela SAC / PRICE em 240 · 300 · 420 meses | 15.472,42 / 11.958,34 · 14.472,42 / 11.306,56 · 13.329,57 / 10.752,04 |
| Extras R$ 100k na nº 12 + R$ 20k a cada 12 meses desde a nº 24, modo prazo, SAC | quita em 228 parcelas, juros R$ 1.125.960,18 |

Testes automáticos (rodam no GitHub Actions a cada push, em `.github/workflows/testes.yml`):

```bash
node tests/engine.test.cjs                       # motor: valores de referência, fechamento, MIP %
NODE_PATH=$(npm root -g) node tests/ui.test.cjs  # interface: abas 375px claro/escuro, FGTS, planta, IPCA, CET,
                                                 # Planejar, link, importação, relatório, desktop, erros de JS
```

Teste rápido em Node (extrai o motor do HTML):

```bash
node -e "const h=require('fs').readFileSync('index.html','utf8');eval(h.split('// ENGINE-START')[1].split('// ENGINE-END')[0].replace(/^.*\n/,''));const s=simular({pv:1200000,iM:taxaMensal(0.1099),n:360,sistema:'SAC',trM:0,seg:0,tarifa:0,extras:[],modo:'prazo'});console.log(s.p1.toFixed(2),s.juros.toFixed(2),s.fechamento)"
# esperado: 13805.76 1890272.62 0
```

## Funcionalidades (mapa para localizar código)

**Dados:** imóvel e entrada com LTV e alerta de entrada mínima (`renderLTV`) · presets de bancos e taxa em a.a./a.m. · SAC / PRICE / comparar · prazo por chips, slider e número (1–420) · amortizações extras pontuais e recorrentes (`renderPontuais`) · renda opcional e comprometimento · correção TR/IPCA · seguros em % ou fixos · FGTS · imóvel na planta · custos da compra.
**Resumo:** 1ª parcela e curva (`renderHero`, `specHero`) · indicadores com CET e quitação (`renderTiles`) · efeito das extras e do FGTS (`renderExtrasRes`) · fase de obra (`renderObra`) · custo total do imóvel em barra 100% (`renderCusto`) · renda com medidor (`renderRenda`) · dinheiro na aquisição (`renderCompra`) · cartão para compartilhar (`renderResumo`, `saveImage`, `share`, `resumoTexto`) · link com a simulação (`linkURL`, `shareLink`, `readLink`; estado em `#s=` base64url, só as chaves diferentes de `DEFAULTS`).
**Gráficos:** evolução mês a mês, juros x amortização por ano, quanto do imóvel é seu, acumulados com ponto de virada, composição do total pago (`renderLeads` gera os textos dinâmicos).
**Comparar:** SAC x PRICE (`renderVS`, `cvVS`) · prazos com barras e tabela (`renderPrazos`, `prazoList`) · entrada (`renderEntrada`) · taxa ±2 p.p. (`renderTaxa`) · cenários A–D (`saveCen`, `renderCen`) com exportar/importar JSON (`exportCen`, `importCen`, que recalcula o resumo de cada cenário).
**Planejar:** meta de quitação, amortizar ou investir, comprar ou alugar, valores de hoje, portabilidade (`renderPlan`, `applyMeta`).
**Tabela:** completa, por ano, 12 primeiras e 12 últimas (`renderTable`, só renderiza com a aba ativa) · exportação CSV no padrão brasileiro (`exportCSV`).
**Relatório:** `openReport` → `buildReport` (inclui CET, FGTS, planta e a seção Planejamento).
**PWA:** `manifest.webmanifest` + `sw.js` (rede primeiro para a página, cache para o resto; registrado só em http/https). Ao mudar arquivos em cache, aumente `CACHE` em `sw.js`. Botão "Instalar como app" aparece com `beforeinstallprompt`.

## Ao modificar

- Antes de entregar, rode `tests/engine.test.cjs` e `tests/ui.test.cjs`. Ao criar recurso novo, acrescente uma verificação no teste de interface.
- Teste em viewport de 375px nos modos claro e escuro, em **todas as abas** (Playwright está disponível nas sessões em nuvem). Não pode haver rolagem horizontal: `document.documentElement.scrollWidth` deve ser 375. Teste também o desktop (1440px) e o relatório.
- Valores monetários longos não podem quebrar linha nem ser cortados em cards estreitos: use `white-space:nowrap` com `clamp()` no tamanho da fonte.
- Copy em pt-BR, frases curtas, sentence case; sem rótulos em caixa alta.
- Novas cores devem ser tokens em `:root`, com equivalente no bloco dark.
- Formate valores com `brl()`, `pct()`, `num()` e `smart()`, e leia entradas com `parseBR()` (aceita `1.600.000`, `1600000`, `10,99`).
- Para novos campos numéricos simples, registre-os em `FIELDS` (`'money'`, `'pct'` ou `'pct4'`). Campos dentro de objetos (`fgts`, `planta`) vão em `NESTED`; campos da aba Planejar usam `data-p="chave" data-t="tipo"` e são tratados automaticamente.
