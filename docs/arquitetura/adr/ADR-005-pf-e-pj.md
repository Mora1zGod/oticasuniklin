# ADR-005 — Pessoa física e pessoa jurídica com perfis especializados

**Status:** Aceito · **Data:** 2026-09-04 · **Briefing:** item 6

## Contexto

O cliente pode ser PF ou PJ (convênios, empresas que compram óculos de segurança,
clínicas parceiras). PJ tem informação fiscal que PF não tem — inscrição estadual,
regime tributário, contribuinte de ICMS, SUFRAMA. Modelar tudo em uma tabela produz
dezenas de colunas nulas e nenhuma validação possível.

## Decisão

**`customers` + perfil 1:1 especializado**, escolhido por `party_type`:

| | `individual_profiles` | `company_profiles` |
|---|---|---|
| Documento | `cpf` (validado) | `cnpj` (validado) |
| Identidade | RG + emissor, nascimento, gênero, estado civil, profissão, filiação | razão social, nome fantasia, fundação |
| Fiscal | — | IE (+ isenção), IM, regime tributário, contribuinte ICMS, SUFRAMA |

Garantias:

- `tg_customer_profile_matches_type` impede perfil incompatível com `party_type`;
- `is_valid_cpf` / `is_valid_cnpj` em `CHECK` — dígito verificador validado no banco,
  em qualquer caminho de escrita;
- unicidade por tenant via índice parcial sobre os dígitos do documento;
- `company_profiles_ie_consistency` impede IE preenchida com isenção marcada.

## Alternativas consideradas

- **Tabela única com todas as colunas.** Rejeitada: nulos estruturais, sem
  `NOT NULL` possível, sem validação por tipo.
- **Duas tabelas independentes (`individuals`, `companies`).** Rejeitada: obrigaria
  FK polimórfica em venda, O.S., financeiro e receita — pior em todos os pontos.
- **`jsonb` de atributos fiscais.** Rejeitada: dado fiscal precisa de constraint,
  índice e unicidade.

## Consequências

**Positivas** — nenhuma coluna nula por inaplicabilidade; validação fiscal real;
uma única FK (`customers.id`) em todo o resto do sistema.

**Negativas** — um `LEFT JOIN` a mais na listagem. Absorvido por `v_customer_overview`.

## Aplicação

`db/migrations/0003_customers.sql`.
