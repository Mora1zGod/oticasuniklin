#!/usr/bin/env bash
# =============================================================================
# Teste de fumaça da API: exercita, via PostgREST, as MESMAS consultas que o app
# faz — inclusive os embeds, que o TypeScript não consegue validar sozinho.
#
#   API=http://localhost:3001 TOKEN=<jwt> ./db/tools/smoke_api.sh
#
# Para rodar contra o Supabase, use a URL do projeto (.../rest/v1) e um token de
# usuário real. Cuidado: ele ESCREVE dados (cliente, receita, venda, O.S.).
# =============================================================================
set -uo pipefail

API="${API:-http://localhost:3001}"
TOKEN="${TOKEN:?defina TOKEN com um JWT do usuário}"
PASS=0
FAIL=0

# Executa e devolve "status<TAB>corpo"
call() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -o /tmp/smoke_body -w '%{http_code}' -X "$method" "$API$path"
              -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json'
              -H 'Prefer: return=representation')
  [[ -n "$body" ]] && args+=(-d "$body")
  local status
  status=$(curl "${args[@]}")
  printf '%s\t%s' "$status" "$(cat /tmp/smoke_body)"
}

# check <nome> <método> <path> [body] — falha se o status não for 2xx
check() {
  local name="$1"; shift
  local result status body
  result=$(call "$@")
  status="${result%%$'\t'*}"
  body="${result#*$'\t'}"
  if [[ "$status" =~ ^2 ]]; then
    echo "  ok   $name"
    PASS=$((PASS + 1))
    LAST_BODY="$body"
  else
    echo "  FAIL $name  (HTTP $status)"
    echo "       ${body:0:240}"
    FAIL=$((FAIL + 1))
    LAST_BODY=""
  fi
}

# expect_rejected <nome> <método> <path> [body] — o banco DEVE recusar
expect_rejected() {
  local name="$1"; shift
  local result status body
  result=$(call "$@")
  status="${result%%$'\t'*}"
  body="${result#*$'\t'}"
  if [[ "$status" =~ ^2 ]]; then
    echo "  FAIL $name  (o banco aceitou, deveria recusar)"
    FAIL=$((FAIL + 1))
  else
    echo "  ok   $name  (recusado: HTTP $status)"
    PASS=$((PASS + 1))
  fi
}

json() { python3 -c "import sys,json; d=json.load(sys.stdin); print($1)"; }

echo "== sessão =="
check "current_session_context" POST /rpc/current_session_context '{}'
TENANT=$(echo "$LAST_BODY" | json 'd["tenant_id"]')
BRANCH=$(echo "$LAST_BODY" | json 'd["branches"][0]["id"]')
APPUSER=$(echo "$LAST_BODY" | json 'd["app_user_id"]')
echo "       tenant=$TENANT"

echo "== catálogos =="
check "resolve_catalog customer_origin" POST /rpc/resolve_catalog "{\"p_catalog_key\":\"customer_origin\",\"p_tenant_id\":\"$TENANT\"}"
check "resolve_catalog relationship_type" POST /rpc/resolve_catalog "{\"p_catalog_key\":\"relationship_type\",\"p_tenant_id\":\"$TENANT\"}"

echo "== clientes =="
check "v_customer_overview" GET '/v_customer_overview?select=*&limit=5'
check "cadastro rápido de cliente" POST /customers "{\"tenant_id\":\"$TENANT\",\"party_type\":\"individual\",\"display_name\":\"Joao da Silva\",\"record_status\":\"quick\",\"created_at_branch_id\":\"$BRANCH\",\"created_by\":\"$APPUSER\"}"
CID=$(echo "$LAST_BODY" | json 'd[0]["id"]')
check "perfil PF com CPF válido" POST /individual_profiles "{\"customer_id\":\"$CID\",\"tenant_id\":\"$TENANT\",\"cpf\":\"52998224725\",\"birth_date\":\"1975-04-12\"}"
check "contato" POST /customer_contacts "{\"customer_id\":\"$CID\",\"tenant_id\":\"$TENANT\",\"kind\":\"whatsapp\",\"value\":\"+5568999990000\",\"is_primary\":true}"
check "embed aniversariantes" GET '/individual_profiles?select=customer_id,birth_date,customers!individual_profiles_customer_id_fkey(display_name)&limit=5'
expect_rejected "CPF com dígito inválido" POST /individual_profiles "{\"customer_id\":\"$CID\",\"tenant_id\":\"$TENANT\",\"cpf\":\"11111111111\"}"

echo "== receita (ADR-001, ADR-002, ADR-007) =="
check "receita em rascunho" POST /optical_prescriptions "{\"tenant_id\":\"$TENANT\",\"customer_id\":\"$CID\",\"branch_id\":\"$BRANCH\",\"issued_at\":\"2026-09-01\",\"vision_use\":\"multifocal\",\"status\":\"draft\",\"created_by\":\"$APPUSER\"}"
PID=$(echo "$LAST_BODY" | json 'd[0]["id"]')
check "medidas OD/OS com DNP clínica" POST /optical_prescription_measures "[{\"prescription_id\":\"$PID\",\"eye\":\"OD\",\"vision_zone\":\"far\",\"sphere_dpt\":-2.00,\"cylinder_dpt\":-0.75,\"axis_deg\":90,\"addition_dpt\":2.00,\"dnp_mm\":32.0},{\"prescription_id\":\"$PID\",\"eye\":\"OS\",\"vision_zone\":\"far\",\"sphere_dpt\":-1.75,\"cylinder_dpt\":-0.50,\"axis_deg\":100,\"addition_dpt\":2.00,\"dnp_mm\":31.0}]"
check "ativar receita" PATCH "/optical_prescriptions?id=eq.$PID" '{"status":"active"}'
check "v_customer_prescriptions" GET "/v_customer_prescriptions?customer_id=eq.$CID&select=*"
check "embed receita + medidas" GET "/optical_prescriptions?id=eq.$PID&select=*,optical_prescription_measures(*)"
expect_rejected "editar medidas de receita emitida" PATCH "/optical_prescription_measures?prescription_id=eq.$PID&eye=eq.OD" '{"sphere_dpt":-9.00}'

echo "== venda =="
check "next_document_number" POST /rpc/next_document_number "{\"p_branch_id\":\"$BRANCH\",\"p_document_type\":\"sale\"}"
SNUM="$LAST_BODY"
check "venda identificada" POST /sales "{\"tenant_id\":\"$TENANT\",\"branch_id\":\"$BRANCH\",\"number\":$SNUM,\"sale_type\":\"identified\",\"customer_id\":\"$CID\",\"status\":\"confirmed\",\"total_amount\":2589.00,\"subtotal_amount\":2589.00,\"created_by\":\"$APPUSER\"}"
SID=$(echo "$LAST_BODY" | json 'd[0]["id"]')
check "formas de pagamento" GET '/payment_methods?select=id,code,generates_receivable,requires_customer&order=sort_order'
PIX=$(echo "$LAST_BODY" | json '[m["id"] for m in d if m["code"]=="pix"][0]')
CRED=$(echo "$LAST_BODY" | json '[m["id"] for m in d if m["code"]=="crediario"][0]')
check "pagamento PIX" POST /sale_payments "{\"sale_id\":\"$SID\",\"tenant_id\":\"$TENANT\",\"payment_method_id\":\"$PIX\",\"amount\":2589.00}"
check "embed venda completa" GET "/sales?id=eq.$SID&select=*,sale_items(*),sale_payments(*,payment_methods(label))"

echo "== venda avulsa (ADR-009) =="
check "next_document_number (avulsa)" POST /rpc/next_document_number "{\"p_branch_id\":\"$BRANCH\",\"p_document_type\":\"sale\"}"
ANUM="$LAST_BODY"
check "venda avulsa anônima" POST /sales "{\"tenant_id\":\"$TENANT\",\"branch_id\":\"$BRANCH\",\"number\":$ANUM,\"sale_type\":\"anonymous\",\"customer_id\":null,\"tax_document_on_invoice\":\"52998224725\",\"status\":\"confirmed\",\"total_amount\":89.90}"
ASID=$(echo "$LAST_BODY" | json 'd[0]["id"]')
check "PIX em venda avulsa" POST /sale_payments "{\"sale_id\":\"$ASID\",\"tenant_id\":\"$TENANT\",\"payment_method_id\":\"$PIX\",\"amount\":89.90}"
expect_rejected "crediário em venda avulsa" POST /sale_payments "{\"sale_id\":\"$ASID\",\"tenant_id\":\"$TENANT\",\"payment_method_id\":\"$CRED\",\"amount\":89.90,\"installments\":3}"
expect_rejected "venda identificada sem cliente" POST /sales "{\"tenant_id\":\"$TENANT\",\"branch_id\":\"$BRANCH\",\"number\":999999,\"sale_type\":\"identified\",\"customer_id\":null,\"total_amount\":10}"

echo "== O.S. e snapshot (ADR-002) =="
check "situação inicial" GET '/service_order_statuses?is_initial=eq.true&select=id'
SSID=$(echo "$LAST_BODY" | json 'd[0]["id"]')
check "next_document_number (O.S.)" POST /rpc/next_document_number "{\"p_branch_id\":\"$BRANCH\",\"p_document_type\":\"service_order\"}"
ONUM="$LAST_BODY"
check "abrir O.S." POST /service_orders "{\"tenant_id\":\"$TENANT\",\"branch_id\":\"$BRANCH\",\"number\":$ONUM,\"customer_id\":\"$CID\",\"sale_id\":\"$SID\",\"status_id\":\"$SSID\",\"frame_source\":\"customer_own\",\"frame_description\":\"Armação do cliente\",\"created_by\":\"$APPUSER\"}"
OSID=$(echo "$LAST_BODY" | json 'd[0]["id"]')
check "take_prescription_snapshot" POST /rpc/take_prescription_snapshot "{\"p_service_order_id\":\"$OSID\",\"p_prescription_id\":\"$PID\",\"p_created_by\":\"$APPUSER\"}"
check "v_service_order_production" GET "/v_service_order_production?service_order_id=eq.$OSID&select=*"
echo "       grau congelado na O.S.: OD $(echo "$LAST_BODY" | json 'd[0]["od_sphere_used"]') · DNP da receita $(echo "$LAST_BODY" | json 'd[0]["od_dnp_prescribed"]')"
expect_rejected "O.S. a partir de venda avulsa" POST /service_orders "{\"tenant_id\":\"$TENANT\",\"branch_id\":\"$BRANCH\",\"number\":999998,\"customer_id\":\"$CID\",\"sale_id\":\"$ASID\",\"status_id\":\"$SSID\",\"frame_source\":\"customer_own\"}"

echo "== montagem e lente (ADR-007, ADR-001) =="
check "medidas de montagem" POST /service_order_fittings "{\"service_order_id\":\"$OSID\",\"tenant_id\":\"$TENANT\",\"dp_total_mm\":63.5,\"dp_source\":\"measured\",\"measured_by\":\"$APPUSER\"}"
FID=$(echo "$LAST_BODY" | json 'd[0]["id"]')
check "DNP de montagem + altura por olho" POST /service_order_fitting_measures "[{\"service_order_fitting_id\":\"$FID\",\"eye\":\"OD\",\"dnp_mm\":32.5,\"fitting_height_mm\":22.0},{\"service_order_fitting_id\":\"$FID\",\"eye\":\"OS\",\"dnp_mm\":31.0,\"fitting_height_mm\":21.5}]"
check "tipos de lente" GET '/lens_types?code=eq.progressive&select=id,requires_addition,requires_fitting_height'
LTID=$(echo "$LAST_BODY" | json 'd[0]["id"]')
check "especificação da lente por olho" POST /service_order_lens_specs "[{\"service_order_id\":\"$OSID\",\"tenant_id\":\"$TENANT\",\"eye\":\"OD\",\"lens_type_id\":\"$LTID\",\"lens_type_label\":\"Multifocal\",\"refractive_index\":1.600,\"supply_mode\":\"surfaced\"},{\"service_order_id\":\"$OSID\",\"tenant_id\":\"$TENANT\",\"eye\":\"OS\",\"lens_type_id\":\"$LTID\",\"lens_type_label\":\"Multifocal\",\"refractive_index\":1.600,\"supply_mode\":\"surfaced\"}]"

echo "== embeds das demais telas =="
check "produtos + lens_attributes (1:1)" GET '/products?select=id,name,lens_attributes(*)&limit=5'
check "lab_orders + itens" GET '/lab_orders?select=*,laboratories(trade_name),lab_order_items(*)&limit=5'
check "transições de status" GET "/service_order_status_transitions?from_status_id=eq.$SSID&select=to_status_id,service_order_statuses!service_order_status_transitions_to_status_id_fkey(id,code,label,stage)"
check "histórico de status" GET "/service_order_status_history?service_order_id=eq.$OSID&select=*,service_order_statuses!service_order_status_history_to_status_id_fkey(label)"
check "usuários + acessos" GET '/app_users?select=*,user_branch_access(branch_id,roles(code,label),branches(trade_name))'
check "papéis + permissões" GET '/roles?select=*,role_permissions(permission_code)'
check "permissions" GET '/permissions?select=*&order=module'
check "comissões" GET '/commissions?select=*,app_users(full_name),sales(number,sold_at)&limit=5'
check "crédito de cliente" GET '/customer_credits?select=*,customers(display_name)&limit=5'
check "estoque" GET "/stock_balances?branch_id=eq.$BRANCH&select=*,products(name,sku,product_kind)"
check "movimentações" GET "/stock_movements?branch_id=eq.$BRANCH&select=*,products(name,sku)&limit=5"
check "contas a pagar" GET '/payables?select=*,suppliers(trade_name),laboratories(trade_name)&limit=5'
check "comunicações" GET '/customer_communications?select=*,customers(display_name)&limit=5'
check "convites + papel" GET '/user_invitations?select=*,roles(label)&limit=5'

echo
echo "RESULTADO: $PASS passaram, $FAIL falharam"
[[ "$FAIL" -eq 0 ]]
