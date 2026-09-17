# Instalar pelo painel do Supabase

Caminho sem instalar nada na máquina: cola dois blocos de SQL no painel e o
sistema está no ar.

> Use este caminho quando não puder rodar `psql`. Para **atualizações** futuras,
> o certo é `./db/tools/deploy.sh`, que aplica só o que falta.

---

## Passo 1 — Criar o schema

**Supabase → SQL Editor → New query**

Cole o conteúdo de [`db/dist/full_install.sql`](../db/dist/full_install.sql) e
clique em **Run**.

São 68 tabelas, todas as políticas de RLS e os catálogos de plataforma. Roda
dentro de uma transação: ou aplica tudo, ou não aplica nada.

No fim aparece:

```
NOTICE:  Tabelas: 68  ·  Migrations registradas: 11
NOTICE:  RLS habilitado em todas as tabelas de negocio.
```

Se aparecer `Este banco ja tem migrations aplicadas`, o schema já está lá —
nada foi alterado. Siga para o passo 2.

---

## Passo 2 — Criar seu usuário

**Authentication → Users → Add user → Create new user**

| Campo | Valor |
|---|---|
| Email | seu e-mail |
| Password | uma senha sua |
| Auto Confirm User | ✅ **marque** |

Copie o **UUID** do usuário criado (a coluna `UID` da lista).

---

## Passo 3 — Criar a ótica

**SQL Editor → New query**, troque o UUID e rode:

```sql
select public.bootstrap_tenant(
  'oticas-uniklin',              -- identificador (só letras, números e hífen)
  'Óticas Uniklin LTDA',         -- razão social
  'Óticas Uniklin',              -- nome fantasia
  'Matriz - Centro',             -- nome da primeira loja
  'Gabriel Moura',               -- seu nome
  '11222333000181',              -- CNPJ (ou null)
  'COLE-AQUI-O-UUID'::uuid
);
```

Isso cria, numa transação: tenant + filial matriz + você como administrador +
3 papéis com 18 permissões + 9 situações de O.S. com as transições + 6 formas de
pagamento + plano de contas + tabela de preço + 6 categorias de produto.

**Confira:**

```sql
select
  (select count(*) from service_order_statuses) as situacoes_os,
  (select count(*) from payment_methods)        as formas_pagamento,
  (select count(*) from chart_accounts)         as plano_de_contas,
  (select count(*) from roles)                  as papeis;
```

Esperado: `9 · 6 · 6 · 3`.

---

## Passo 4 — Publicar o app

**Project Settings → API**, copie:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon public** → `VITE_SUPABASE_ANON_KEY`

> A `service_role` **nunca** vai para o frontend: ela ignora a RLS.

Na **Vercel** → New Project → importe este repositório:

| Campo | Valor |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variables | as duas acima |

Depois do deploy, volte em **Authentication → URL Configuration** e ponha a URL
publicada em **Site URL**.

---

## Passo 5 — Entrar

Abra a URL publicada, entre com o e-mail e a senha do passo 2. Você cai direto no
painel da ótica.

Para convidar a equipe: **Administração → Usuários e convites → Convidar**. Quem
for convidado cria a conta com o mesmo e-mail e já entra com papel e filial.

---

## Regenerar o instalador

Se alguma migration mudar:

```bash
python3 db/tools/build_installer.py
```
