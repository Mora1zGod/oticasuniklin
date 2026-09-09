# Tipos TypeScript

Os tipos **não são escritos à mão**. `db/tools/gen_types.py` introspecta o Postgres
onde as migrations foram aplicadas (`information_schema` + `pg_catalog`) e emite:

| Arquivo | Conteúdo |
|---|---|
| `src/types/database.ts` | tipo `Database` compatível com `@supabase/supabase-js` — 65 tabelas, 3 views, 13 funções, 798 colunas |
| `src/types/domain.ts` | 68 uniões derivadas dos `CHECK`, branded types, aliases e guardas de domínio |
| `src/types/domain.test-d.ts` | testes de tipo (compile-time) que provam que as distinções dos ADRs estão vigiadas |

## Regerando

```bash
npm run types:gen     # ./db/tools/validate.sh && python3 db/tools/gen_types.py
npm run types:check   # tsc --noEmit
```

Se uma migration mudar uma coluna, o tipo muda na próxima geração. Não existe
possibilidade de o tipo divergir do banco: a fonte é o banco.

> Alternativa oficial: `supabase gen types typescript --project-id <id>`. O gerador
> local existe porque (a) roda sem projeto remoto, no mesmo banco descartável do
> `validate.sh`, e (b) transforma os `CHECK` em uniões de string — o `gen types` do
> Supabase só faz isso para `CREATE TYPE ... AS ENUM`, e o produto escolheu `CHECK`
> deliberadamente (ADR-010).

## Mapeamento de tipos

| PostgreSQL | TypeScript |
|---|---|
| `uuid`, `text`, `citext`, `char`, `varchar` | `string` |
| `date`, `timestamptz`, `timestamp`, `interval` | `string` |
| `numeric`, `integer`, `smallint`, `bigint`, `real` | `number` |
| `boolean` | `boolean` |
| `json`, `jsonb` | `Json` |
| `uuid[]`, `text[]` | `string[]` |
| coluna com `CHECK (col = ANY (ARRAY[...]))` | união de literais |

Regras de `Row` / `Insert` / `Update`, iguais às do gerador do Supabase:

- **Row** — todas as colunas; `| null` quando a coluna é nullable.
- **Insert** — opcional quando a coluna é nullable, tem `DEFAULT`, é `IDENTITY` ou
  é gerada. `NOT NULL` sem default é obrigatório.
- **Update** — tudo opcional.
- **Relationships** — extraídas das FKs reais (`pg_constraint`), inclusive as
  compostas `(id, tenant_id)`.

`CHECK`s compostos (`(status = 'void') = (void_reason IS NOT NULL)`) são
deliberadamente ignorados: são regra de negócio, não domínio de valores.

## O que o compilador passa a impedir

Cada item abaixo é um teste em `src/types/domain.test-d.ts`. Todo `@ts-expect-error`
é uma assertiva: se o erro deixar de acontecer, o `tsc` falha por diretiva não usada.

### ADR-001 — receita não é lente

```ts
const receita: TablesInsert<'optical_prescriptions'> = {
  tenant_id, customer_id, issued_at: '2026-09-04',
  // @ts-expect-error ADR-001: material da lente não existe na receita clínica
  lens_material_id: 'uuid',
}
```

A separação deixa de depender de disciplina do desenvolvedor: a coluna não existe
no tipo porque não existe na tabela.

### ADR-007 — DNP clínica ≠ DNP de montagem

As três medidas são `numeric(4,1)` no banco, então o Postgres não impede trocar uma
pela outra. No TypeScript elas são **branded types** distintos:

```ts
declare function centralizarLente(dnpMontagem: FittingDnpMm): void

centralizarLente(fittingDnp(32.5))      // ok
// @ts-expect-error DNP prescrita não substitui DNP de montagem
centralizarLente(prescribedDnp(32.0))
// @ts-expect-error number cru também não — obriga passar pelo construtor
centralizarLente(32.5)
```

Construtores: `prescribedDnp`, `fittingDnp`, `totalDp`, `fittingHeight`.

### ADR-009 — venda anônima nunca tem cliente

```ts
export type IdentifiedSale = Sale & { sale_type: 'identified'; customer_id: string }
export type AnonymousSale  = Sale & { sale_type: 'anonymous';  customer_id: null }

if (isIdentifiedSale(venda)) {
  const clienteId: string = venda.customer_id  // estreitado, não é `| null`
}

// porta de entrada de O.S., crediário e financeiro:
const venda = requireIdentifiedSale(qualquerVenda)
```

### ADR-005 — PF/PJ

```ts
if (isIndividual(cliente)) { /* cliente.party_type === 'individual' */ }
if (isCompany(cliente))    { /* cliente.party_type === 'company' */ }
```

### ADR-010 — rótulo do tenant vs. estágio canônico

```ts
const estagio: ServiceOrderStatusStage = 'awaiting_lab'  // ok
// @ts-expect-error 'no_lab' é rótulo do tenant (code/label), não estágio canônico
const invalido: ServiceOrderStatusStage = 'no_lab'
```

## Usando com o Supabase client

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

// A view de produção já vem tipada, inclusive as duas DNPs lado a lado:
const { data } = await supabase
  .from('v_service_order_production')
  .select('number, od_dnp_prescribed, od_dnp_fitting, od_height, dp_total_mm')
  .eq('service_order_id', osId)
  .single()

// Funções do banco também:
const { data: vigente } = await supabase.rpc('latest_active_prescription', {
  p_customer_id: clienteId,
})
```

> As RPCs disponíveis incluem `take_prescription_snapshot`,
> `latest_active_prescription`, `customer_missing_fields`, `next_document_number`,
> `resolve_catalog`, `is_valid_cpf`, `is_valid_cnpj` e os helpers de RLS.

## Limitações conhecidas

- **`numeric` vira `number`.** Valores monetários acima de 2^53 perderiam precisão —
  irrelevante nas faixas do domínio (`numeric(12,2)`), mas registrado aqui.
- **`timestamptz` vira `string`** (ISO-8601), como no gerador do Supabase. Converter
  para `Date` é responsabilidade da camada de apresentação.
- **Views são `Row` apenas** — não há `Insert`/`Update`, coerente com views não
  atualizáveis.
- **Branded types são convenção de aplicação**, não constraint de banco. O banco já
  separa as medidas em tabelas diferentes (ADR-007); os brands impedem a troca
  dentro do código TypeScript.
