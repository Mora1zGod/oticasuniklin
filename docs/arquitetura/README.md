# Arquitetura — SaaS para óticas

Documentação de domínio e dados. Ordem de leitura sugerida:

| # | Documento | Conteúdo |
|---|---|---|
| 1 | [Distinções de domínio](01-distincoes-de-dominio.md) | resposta ponto a ponto aos 12 itens do briefing |
| 2 | [Modelo de dados](02-modelo-de-dados.md) | contextos, ERD, convenções, RLS |
| 3 | [Cenário de validação](03-cenario-de-validacao.md) | a regra final do item 12, executável |
| 4 | [Mapa de menu](04-mapa-de-menu.md) | navegação derivada do domínio |
| 5 | [Catálogos e enums](05-catalogos-e-enums.md) | classificação completa das listas |
| 6 | [Tipos TypeScript](06-tipos-typescript.md) | geração por introspecção e garantias em tempo de compilação |

## Decisões (ADR)

| ADR | Decisão | Item |
|---|---|---|
| [001](adr/ADR-001-receita-nao-e-lente.md) | Receita não é lente | 1 |
| [002](adr/ADR-002-snapshot-e-versionamento-da-receita.md) | Snapshot na O.S. + versionamento clínico | 2 |
| [003](adr/ADR-003-relacionamento-cliente-cliente.md) | Responsável/dependente em N:N, sem "Família" | 5 |
| [004](adr/ADR-004-cliente-agregador.md) | Cliente agregador, históricos normalizados | 4 |
| [005](adr/ADR-005-pf-e-pj.md) | PF/PJ com perfis 1:1 especializados | 6 |
| [006](adr/ADR-006-cadastro-rapido.md) | Cadastro rápido é o mesmo cadastro | 7 |
| [007](adr/ADR-007-dnp-nao-e-dp.md) | DNP ≠ DP ≠ medidas de montagem | 3 |
| [008](adr/ADR-008-cliente-pertence-ao-tenant.md) | Cliente é do tenant; filial é proveniência | 9 |
| [009](adr/ADR-009-cliente-avulso.md) | Venda avulsa anônima, sem "Cliente Padrão" | 8 |
| [010](adr/ADR-010-politica-de-enums-e-catalogos.md) | Política de enums e catálogos | 11 |
| [011](adr/ADR-011-navegacao-derivada-do-dominio.md) | Navegação derivada do domínio | 10 |

## As três regras que sustentam tudo

1. **Receita é clínica.** Lente, material, índice, tratamento, fabricante e preço
   vivem na O.S. e no catálogo — nunca na prescrição.
2. **A O.S. congela o que produziu.** Snapshot tipado com procedência; nova receita
   não altera produção passada.
3. **O tenant isola; a filial opera.** O cliente é da rede; o documento é da unidade.
