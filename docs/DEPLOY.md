# Pôr no ar

Passo a passo real, do zero até a primeira ótica operando. O que **você** faz está
marcado com 👤 (precisa da sua conta); o resto já está pronto no repositório.

---

## 1. 👤 Criar o projeto Supabase — ~2 min

[supabase.com/dashboard](https://supabase.com/dashboard) → **New project**

| Campo | Valor |
|---|---|
| Name | `oticas-uniklin` |
| Region | **South America (São Paulo)** — menor latência para o Acre |
| Database password | gere uma forte e **guarde** (é a senha do `postgres`) |

Depois, em **Project Settings → Database → Connection string → URI**, copie a
string. Ela é do tipo:

```
postgresql://postgres.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres
```

> Para rodar migrations use a porta **5432** (conexão direta / session pooler), não
> a 6543 (transaction pooler) — DDL em transação não funciona bem na 6543.

---

## 2. Aplicar o schema — 1 comando

```bash
export DATABASE_URL="postgresql://postgres.<ref>:<senha>@<host>:5432/postgres"
./db/tools/deploy.sh --seeds
```

Saída esperada:

```
==> migrations
    + 0001_core_tenant_branch
    ...
    + 0010_onboarding_bootstrap
==> conferencia
 tabelas | policies | com_rls | migrations
      68 |       98 |      67 |         10
    RLS habilitado em todas as tabelas de negocio.
==> OK — schema no ar
```

O script é **idempotente**: registra o que já aplicou em `public.schema_migrations`
e roda só o que falta. Rodar duas vezes não quebra nada.

Guarda-corpos que ele aplica sozinho:

- recusa banco sem o schema `auth` do Supabase;
- recusa reaplicar migration que mudou de conteúdo depois de aplicada (o certo é
  criar uma nova);
- avisa se alguma tabela de negócio ficou sem RLS;
- `--dry-run` mostra o que faria, sem tocar no banco.

---

## 3. 👤 Configurar o Auth

**Authentication → Providers → Email**: deixe habilitado.

**Authentication → URL Configuration**: preencha `Site URL` com o endereço do app
(ex.: `https://oticas.uniklin.com`) e adicione as *Redirect URLs* de
desenvolvimento (`http://localhost:5173/**`).

> Mantenha **Confirm email** ligado. O fluxo de equipe deste sistema é por convite:
> o convite é registrado antes, e o `signup` do convidado já cai com acesso pronto.

---

## 4. Criar a primeira ótica

O usuário se cadastra normalmente pelo app. No primeiro login ele ainda não
pertence a nenhuma ótica — `current_session_context()` devolve
`{"status":"needs_onboarding"}` e a tela de onboarding chama:

```ts
const { data: tenantId } = await supabase.rpc('bootstrap_tenant', {
  p_slug: 'oticas-uniklin',
  p_legal_name: 'Óticas Uniklin LTDA',
  p_trade_name: 'Óticas Uniklin',
  p_branch_name: 'Matriz - Centro',
  p_admin_name: 'Gabriel Moura',
  p_tax_document: '11222333000181',
})
```

Isso cria, numa transação: **tenant + filial matriz + usuário admin + 3 papéis com
18 permissões + 9 situações de O.S. com transições + 6 formas de pagamento + plano
de contas + tabela de preço + 6 categorias de produto.**

A ótica já nasce operando — não existe passo "configure 40 tabelas antes de vender".

### Sem app ainda? Dá para criar pelo SQL Editor

Cadastre o usuário em **Authentication → Users → Add user**, copie o UUID dele e
rode no **SQL Editor**:

```sql
select public.bootstrap_tenant(
  'oticas-uniklin',
  'Óticas Uniklin LTDA',
  'Óticas Uniklin',
  'Matriz - Centro',
  'Gabriel Moura',
  '11222333000181',
  '<UUID-do-usuario>'::uuid
);
```

---

## 5. Convidar a equipe

```sql
insert into public.user_invitations
  (tenant_id, email, full_name, role_id, branch_ids, is_salesperson)
select t.id, 'maria@oticasuniklin.com', 'Maria Vendedora',
       r.id, array[b.id], true
from public.tenants t
join public.roles r on r.tenant_id = t.id and r.code = 'sales'
join public.branches b on b.tenant_id = t.id and b.code = 'MATRIZ'
where t.slug = 'oticas-uniklin';
```

Quando a Maria se cadastrar com esse e-mail, o trigger `on_auth_user_created`
converte o convite em acesso — com papel, permissões e filial. Papéis disponíveis:
`admin`, `sales`, `lab`.

---

## 6. 👤 Variáveis do frontend

```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Ambas ficam em **Project Settings → API**.

> ⚠️ A **`service_role` key nunca vai para o frontend.** Ela ignora RLS. Só em Edge
> Function ou backend. A `anon key` é pública por design — quem protege os dados é
> a RLS, e ela está habilitada nas 67 tabelas de negócio.

---

## 7. Conferir que está de pé

```sql
-- contexto da sessão (rode logado pelo app, não pelo SQL Editor)
select public.current_session_context();

-- a ótica nasceu completa?
select
  (select count(*) from service_order_statuses) as situacoes_os,
  (select count(*) from payment_methods)        as formas_pagamento,
  (select count(*) from chart_accounts)         as plano_de_contas,
  (select count(*) from roles)                  as papeis;
```

---

## O que falta para o sistema estar no ar de verdade

| Item | Estado |
|---|---|
| Schema, RLS, regras de domínio | ✅ pronto e validado |
| Onboarding (tenant, admin, convites, padrões) | ✅ pronto e validado |
| Tipos TypeScript | ✅ gerados do schema |
| Deploy do banco | ✅ 1 comando |
| **Frontend (telas)** | ❌ **não existe** |

O banco sobe hoje. **O que falta é o aplicativo.**

---

## Rollback

`schema_migrations` registra versão + checksum. Para voltar atrás, crie uma
migration nova que desfaz (`0011_...`) — não edite migration já aplicada: o deploy
recusa e avisa, de propósito.

Antes de qualquer mudança grande em produção: **Database → Backups** no painel do
Supabase (point-in-time recovery nos planos pagos).
