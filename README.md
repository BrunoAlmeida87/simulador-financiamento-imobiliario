# Simulador de Financiamento Imobiliário

**"Se eu comprar este imóvel, quanto vou pagar por mês?"**

Simulador mobile first em um único arquivo HTML: SAC x PRICE, TR, seguros, amortizações extras, comparador de prazos, cenários e resumo para compartilhar.

▶️ **Abrir:** https://brunoalmeida87.github.io/simulador-financiamento-imobiliario/

## Funcionalidades

- Entrada em R$ ou em %, valor financiado e LTV com alerta de limite do banco
- Presets de bancos (editáveis no código) e taxa anual ↔ mensal **equivalente**
- SAC, PRICE ou comparação lado a lado; prazo de 1 a 420 meses
- TR estimada, seguros MIP/DFI e tarifa administrativa
- **Amortizações extras** pontuais ou recorrentes (ex.: 13º todo ano), reduzindo **prazo** ou **parcela**, com a economia de juros calculada
- Renda mínima estimada, comparador de prazos, impacto de entrada e de taxa
- Gráfico interativo e tabela de amortização completa ou anual
- Até 4 cenários salvos no navegador
- Compartilhar, copiar resumo, salvar como imagem e imprimir/PDF
- Modo claro e escuro automáticos

## Uso

Abra o `index.html` no navegador. Não precisa de instalação nem de servidor.

Para alterar as taxas de referência dos bancos, edite a constante `BANCOS` no início do segundo `<script>`.

## Fórmulas

- Taxa mensal: `i_m = (1 + i_a)^(1/12) − 1`
- SAC: `A = PV/n`, `J = saldo × i`, `P = A + J`
- PRICE: `PMT = PV · i(1+i)^n / ((1+i)^n − 1)`

---

> Esta ferramenta é apenas uma simulação financeira e não representa proposta, aprovação ou oferta de crédito. Taxas, seguros, TR, tarifas, critérios de renda e condições podem variar conforme banco e perfil do cliente.
