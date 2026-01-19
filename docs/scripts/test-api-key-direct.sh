#!/bin/bash
# =====================================================
# TEST DIRECTO DE LA API KEY
# =====================================================
#
# Este script prueba la API key directamente contra
# el endpoint de Supabase para confirmar que funciona
#
# Uso: bash test-api-key-direct.sh
# =====================================================

API_KEY="wsk_prod_LHEoIcQ280UNkYUKE7kUHtmmTQZtxl8Vm0GgdiVg"
ENDPOINT="https://ujigyazketblwlzcomve.supabase.co/functions/v1/api-search"

echo "════════════════════════════════════════════════════════════════"
echo "🧪 TESTING API KEY DIRECTAMENTE"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "API Key: ${API_KEY:0:30}..."
echo "Endpoint: $ENDPOINT"
echo ""

echo "📤 Enviando request..."
echo ""

response=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "request_id": "test_debug_001",
    "prompt": "vuelo a miami del 10 al 20 de enero, 2 adultos"
  }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "📥 Response:"
echo "Status Code: $http_code"
echo ""

if [ "$http_code" = "200" ] || [ "$http_code" = "422" ]; then
  echo "✅ SUCCESS - API key funciona correctamente"
  echo ""
  echo "Response Body:"
  echo "$body" | jq '.' 2>/dev/null || echo "$body"
elif [ "$http_code" = "401" ]; then
  echo "❌ ERROR 401 - API key inválida o no encontrada"
  echo ""
  echo "Response Body:"
  echo "$body"
elif [ "$http_code" = "403" ]; then
  echo "❌ ERROR 403 - Sin permisos (scopes insuficientes)"
  echo ""
  echo "Response Body:"
  echo "$body"
  echo ""
  echo "Posibles causas:"
  echo "  1. La API key no tiene scope 'search:*'"
  echo "  2. La API key está inactiva (is_active = false)"
  echo "  3. El tenant_id no coincide"
elif [ "$http_code" = "429" ]; then
  echo "❌ ERROR 429 - Rate limit excedido"
  echo ""
  echo "Response Body:"
  echo "$body"
else
  echo "❌ ERROR $http_code - Error inesperado"
  echo ""
  echo "Response Body:"
  echo "$body"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
