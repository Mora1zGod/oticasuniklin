# ADR-011 — Navegação derivada do domínio

**Status:** Aceito · **Data:** 2026-09-04 · **Briefing:** item 10

## Contexto

O sistema auditado tem "Cadastros → Tabelas", agrupando cadastros sem relação entre
si. Estruturas de menu como essa tendem a vazar para o modelo: cria-se uma tabela
genérica "tabelas do sistema" porque o menu diz que aquilo é um grupo.

## Decisão

Ordem obrigatória: **modelar o domínio primeiro, derivar o menu depois.**

O modelo foi fechado nas migrations `0001`–`0009`. O menu foi derivado em
`docs/arquitetura/04-mapa-de-menu.md`, com a regra: um item existe porque uma
entidade existe, e o agrupamento é o contexto dessa entidade.

Grupos resultantes: Início · Clientes · Óptica · Comercial · Ordens de serviço ·
Produtos · Estoque · Financeiro · Administração.

## O que não existe no menu

| Não existe | Por quê |
|---|---|
| "Cadastros → Tabelas" | agrupamento sem semântica |
| "Cliente Padrão" | não existe no modelo (ADR-009) |
| "Cadastro rápido" como tela | é modal do mesmo cadastro (ADR-006) |
| "Família" | vínculo é cliente↔cliente (ADR-003) |
| "Lentes da receita" | lente não pertence à receita (ADR-001) |

## Teste de coerência

Se um item de menu não corresponde a uma entidade ou a uma view do domínio, ou o
item é supérfluo, ou falta modelagem. Nos dois casos, o menu não é a resposta.

## Consequências

**Positivas** — a navegação fica estável mesmo quando a UI mudar; onboarding fica
previsível; nenhuma tabela genérica nasce para servir o menu.

**Negativas** — a estrutura difere do sistema auditado; migração de usuários exige
um mapa de equivalência. Aceito.

## Aplicação

`docs/arquitetura/04-mapa-de-menu.md`.
