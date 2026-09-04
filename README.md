# Óticas Uniklin — SaaS de gestão para óticas

Plataforma multi-tenant para óticas: cadastro clínico e comercial, orçamento, venda,
ordem de serviço com controle óptico completo, laboratório, estoque, financeiro e
comissão.

**Stack:** React + TypeScript + Tailwind · Supabase (PostgreSQL, Auth, RLS, Edge
Functions).

## Estado atual

Esta fase entrega a **arquitetura de domínio e o schema do banco**, com as
distinções confirmadas na auditoria do sistema legado preservadas explicitamente.

```
db/
  migrations/   0001..0009  schema completo (Postgres 16 / Supabase)
  seeds/        catálogos de plataforma
  tools/        validate.sh · scenario_item12.sql · supabase_shim.sql
docs/
  arquitetura/  documentação de domínio + 11 ADRs
```

## Começando pela documentação

Leia [`docs/arquitetura/01-distincoes-de-dominio.md`](docs/arquitetura/01-distincoes-de-dominio.md).
É o documento que responde, ponto a ponto, às 12 distinções de domínio, com
referência ao ADR e ao arquivo de migration que implementa cada uma.

## Validando o schema

```bash
# requer psql apontando para um Postgres 14+ vazio
./db/tools/validate.sh
```

O script recria o banco, aplica migrations e seeds e executa o cenário completo do
item 12 do briefing (cliente → receita R1 → orçamento → venda PIX+cartão → O.S. com
snapshot → laboratório → estoque → financeiro → comissão → entrega → receita R2),
com 7 assertivas que falham em erro se a arquitetura não representar o cenário.

Resultado da última execução:
[`docs/arquitetura/03-cenario-de-validacao.md`](docs/arquitetura/03-cenario-de-validacao.md).

## Aplicando no Supabase

As migrations usam apenas o que o Supabase já oferece (`auth.users`, `auth.uid()`,
`pgcrypto`, `citext`). Aplique `db/migrations/*.sql` em ordem, depois
`db/seeds/*.sql`. **Não aplique** `db/tools/supabase_shim.sql` — ele existe só para
validação local, onde o schema `auth` não existe.

## Princípios não negociáveis

1. **Receita é prescrição clínica.** Lente, material, índice, tratamento,
   fabricante e preço não entram nela.
2. **A O.S. congela o que produziu.** Nova receita nunca altera produção passada.
3. **DNP, DNP de montagem e DP total são medidas distintas.**
4. **O cliente é do tenant.** A filial é proveniência e preferência, não dono.
5. **Não existe "Cliente Padrão".** Venda avulsa é anônima, com regras próprias.
6. **RLS no banco.** Validação de permissão nunca fica só no frontend.
