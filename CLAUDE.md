# CLAUDE.md — Simulador de Financiamento Imobiliário

Contexto para a IA. Leia antes de alterar qualquer coisa neste repositório.

## O que é

Simulador de financiamento imobiliário brasileiro que responde a uma pergunta: **"Se eu comprar este imóvel, quanto vou pagar por mês?"**

- **Um único arquivo `index.html`** com todo o HTML, CSS e JavaScript. Não tem backend, build nem dependências locais.
- Para usar, basta abrir o arquivo no navegador. Também é publicado via GitHub Pages em https://brunoalmeida87.github.io/simulador-financiamento-imobiliario/
- **Mobile first**: a tela de referência tem 375px de largura. A partir de 1000px o layout vira 2 colunas (entradas fixas à esquerda, resultados à direita).
- Modo claro e escuro automáticos, via `prefers-color-scheme`.
- Interface, textos e formatação em **pt-BR** (`R$ 1.234.567,89`, `10,99%`).
- Autor/usuário: Bruno (Rio de Janeiro). Ele se comunica em português e prefere respostas diretas, tecnicamente precisas e com tabelas para números.

## Regras que não podem ser quebradas

1. **Arquivo único.** Não separe CSS/JS em outros arquivos e não adicione etapa de build. A única dependência externa é o `html2canvas` via CDN (cdnjs), carregado sob demanda só no botão "Salvar como imagem". Todo o resto precisa funcionar offline.
2. **Taxa mensal equivalente:** `i_m = (1 + i_a)^(1/12) − 1`. **Nunca** use `taxa anual / 12`.
3. **Precisão interna cheia.** Só arredonde na exibição.
4. **Não declare qual sistema (SAC/PRICE) é "melhor".** Apresente apenas os números.
5. **Taxas dos bancos são referências editáveis**, não oficiais. Mantenha os avisos de que são estimativas, tanto para taxas e TR quanto para renda.
6. Mantenha o aviso legal do rodapé ("não representa proposta, aprovação ou oferta de crédito…").
7. O cálculo atualiza automaticamente a cada alteração. Não existe botão "Calcular" obrigatório.

## Estrutura do `index.html`

| Trecho | Conteúdo |
|---|---|
| `<style>` | Tokens em `:root` (claro) + bloco dark (`prefers-color-scheme` e `[data-theme]`); cores de série `--s-*`; `@media print` |
| `<header>` | Marca, valor da 1ª parcela ao vivo (`#live`) e botão Relatório |
| `<main>` | `#tab-dados` (entradas, em `<aside>`) e `.mainc` com as abas `#tab-resumo`, `#tab-graficos`, `#tab-comparar`, `#tab-tabela` |
| `#relModal` | Pré-visualização do relatório em `<iframe srcdoc>` |
| 1º `<script>` entre `// ENGINE-START` e `// ENGINE-END` | **Motor de cálculo puro**, sem DOM: `taxaMensal`, `taxaAnual`, `pmt`, `buildExtras`, `simular`, `resumir` |
| 2º `<script>` (IIFE) | Configuração, estado, formatação, motor de gráficos, renderização, relatório, abas, eventos |

### Design

- Identidade: azul-marinho como tinta (`--ink`/`--primary`), latão (`--brass`) só para destaques (pontos-chave da curva, número do cartão), fundo papel azulado. Fonte **Schibsted Grotesk** (Google Fonts) com números tabulares; sem internet, usa a fonte do sistema.
- **Navegação:** no celular (< 1024px) há uma aba visível por vez e barra inferior `.bnav` (Dados, Resumo, Gráficos, Comparar, Tabela). No desktop, Dados fica fixo à esquerda e as outras abas aparecem no topo (`.tabs`). A aba atual é salva em `sfi_tab_v1`. Use `setTab(id)` e `applyTab()`.
- O destaque principal é o número da 1ª parcela (`moneyHTML`) com a curva de parcelas (`cvHero`). Os pontos em latão marcam 5 anos, meio e última, e batem com os itens marcados em `#heroKeys`.

### Gráficos (canvas puro, sem biblioteca)

- Motor: `drawChart(cv, spec, theme, hover, W, H, dpr)` com tipos `line`, `stack` (barras empilhadas), `hbar` e `donut`. Tooltip por toque/mouse, legenda automática para 2 ou mais séries.
- **Specs usam papéis de cor**, não hex (`'amort'`, `'juros'`, `'entrada'`, `'extra'`, `'tr'`, `'seg'`, `'custos'`, `'sac'`, `'price'`, `'base'`, `'main'`), resolvidos por `TH.light`/`TH.dark`. O mesmo spec desenha na tela e no relatório (`chartImage`, sempre claro).
- Paleta validada para daltonismo (claro e escuro). Mantenha os papéis: amortização = azul, juros = laranja, entrada/extras = verde-água, TR = amarelo, seguros = magenta, custos de compra/PRICE = violeta, "sem extras" = cinza tracejado. `TH` e as variáveis `--s-*` do CSS devem ficar sincronizados.
- Gráficos registrados com `mount(id, specFn)`: `cvHero`, `cvEvo` (métrica em `evoMetric`), `cvAnual`, `cvPat` (quanto do imóvel é seu), `cvAcum` (cruzamento entre juros e amortização acumulados), `cvDonut`, `cvVS`, `cvPrazoP`, `cvPrazoJ`. Um `ResizeObserver` redesenha cada um quando a aba aparece.

### Relatório

`buildReport()` gera um HTML A4 independente (tema claro, gráficos em PNG embutidos). O modal oferece Imprimir/PDF, Baixar (.html) e Abrir em nova aba. Ao adicionar uma seção na tela, avalie incluí-la no relatório.

### Configuração (topo do 2º script) — os pontos editados com mais frequência

- `BANCOS` — presets `{ id, nome, taxa }` em % a.a. efetiva. `taxa: null` corresponde a "Personalizado".
- `PRAZOS_ANOS` (chips 10–35 anos), `PRAZOS_COMPARADOR` (240/300/360/420 meses), `ENTRADAS_EXTRA` (+50k/+100k/+200k), `MAX_CENARIOS` (4).
- `DEFAULTS` — dados iniciais de demonstração: imóvel R$ 1.600.000, entrada R$ 400.000, 10,99% a.a., 360 meses, SAC, comprometimento de renda de 30%, TR desligada, seguros R$ 0, LTV máximo de 80%, ITBI de 3%, renda 0 (opcional).
- Chaves do localStorage: `sfi_state_v1` (último estado), `sfi_cenarios_v1` (até 4 cenários) e `sfi_tab_v1` (aba atual). Ao mudar o formato do estado, faça o bump da versão da chave ou ajuste `normState()`.

### Fluxo

`evento` → altera o objeto de estado `S` → `update()` (agrupa via requestAnimationFrame) → `run()` → `compute()` preenche `R` (`R.sac`, `R.price`, `R.main`, `R.base` = sem extras, `R.ann` = resumo anual, `R.cc` = custos da compra) → funções `render*()` → `paintAll()` → salva `S` no localStorage.

Para simular variações (comparador de prazos, entrada, taxa), use `sim(overrides)`, por exemplo `sim({ prazo: 300, sistemaCalc: 'PRICE' })`.

## Modelo financeiro (`simular(o)`)

Entrada: `{ pv, iM, n, sistema: 'SAC'|'PRICE', trM, seg, tarifa, extras[], modo: 'prazo'|'parcela' }`.

A cada mês `k`:
1. **TR:** `corr = saldo × trM`; o saldo é corrigido **antes** dos juros. A amortização base (SAC) e a PMT base (PRICE) também são corrigidas por `(1+trM)`.
2. `juros = saldo × iM`.
3. **SAC:** amortização = `PV/n`, constante (com TR, corrigida).
   **PRICE:** prestação = `PMT = PV·i(1+i)^n / ((1+i)^n − 1)`, constante (com TR, corrigida); amortização = PMT − juros.
4. Na última parcela, ou se a amortização passar do saldo, amortiza o saldo inteiro.
5. **Amortização extra** (`extras[k]`) é abatida do saldo **após** a parcela k.
   - `modo 'prazo'`: mantém amortização (SAC) ou prestação (PRICE) e o contrato termina antes.
   - `modo 'parcela'`: mantém o prazo e recalcula sobre o saldo e as parcelas restantes (`saldo/rem` no SAC, `pmt(saldo,i,rem)` no PRICE).
6. Seguros (MIP+DFI) e tarifa são valores fixos mensais somados ao total enquanto houver saldo.

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

Teste rápido em Node (extrai o motor do HTML):

```bash
node -e "const h=require('fs').readFileSync('index.html','utf8');eval(h.split('// ENGINE-START')[1].split('// ENGINE-END')[0].replace(/^.*\n/,''));const s=simular({pv:1200000,iM:taxaMensal(0.1099),n:360,sistema:'SAC',trM:0,seg:0,tarifa:0,extras:[],modo:'prazo'});console.log(s.p1.toFixed(2),s.juros.toFixed(2),s.fechamento)"
# esperado: 13805.76 1890272.62 0
```

## Funcionalidades (mapa para localizar código)

**Dados:** imóvel e entrada com LTV e alerta de entrada mínima (`renderLTV`) · presets de bancos e taxa em a.a./a.m. · SAC / PRICE / comparar · prazo por chips, slider e número (1–420) · amortizações extras pontuais e recorrentes (`renderPontuais`) · renda opcional e comprometimento · TR · seguros/tarifa · custos da compra.
**Resumo:** 1ª parcela e curva (`renderHero`, `specHero`) · indicadores (`renderTiles`) · efeito das extras (`renderExtrasRes`) · custo total do imóvel em barra 100% (`renderCusto`) · renda com medidor (`renderRenda`) · dinheiro na aquisição (`renderCompra`) · cartão para compartilhar (`renderResumo`, `saveImage`, `share`, `resumoTexto`).
**Gráficos:** evolução mês a mês, juros x amortização por ano, quanto do imóvel é seu, acumulados com ponto de virada, composição do total pago (`renderLeads` gera os textos dinâmicos).
**Comparar:** SAC x PRICE (`renderVS`, `cvVS`) · prazos com barras e tabela (`renderPrazos`, `prazoList`) · entrada (`renderEntrada`) · taxa ±2 p.p. (`renderTaxa`) · cenários A–D (`saveCen`, `renderCen`).
**Tabela:** completa, por ano, 12 primeiras e 12 últimas (`renderTable`, só renderiza com a aba ativa) · exportação CSV no padrão brasileiro (`exportCSV`).
**Relatório:** `openReport` → `buildReport`.

## Ao modificar

- Antes de entregar, rode o teste Node acima e confira os valores de referência.
- Teste em viewport de 375px nos modos claro e escuro, em **todas as abas** (Playwright está disponível nas sessões em nuvem). Não pode haver rolagem horizontal: `document.documentElement.scrollWidth` deve ser 375. Teste também o desktop (1440px) e o relatório.
- Valores monetários longos não podem quebrar linha nem ser cortados em cards estreitos: use `white-space:nowrap` com `clamp()` no tamanho da fonte.
- Copy em pt-BR, frases curtas, sentence case; sem rótulos em caixa alta.
- Novas cores devem ser tokens em `:root`, com equivalente no bloco dark.
- Formate valores com `brl()`, `pct()`, `num()` e `smart()`, e leia entradas com `parseBR()` (aceita `1.600.000`, `1600000`, `10,99`).
- Para novos campos numéricos simples, registre-os em `FIELDS` (`'money'` ou `'pct'`). O sync de input, o blur e a formatação já tratam esses campos.
