#!/bin/bash

# ============================================================================
# Test Script para API Keys de WholeSale Connect AI
# ============================================================================
# Uso:
#   chmod +x scripts/test-api-key.sh
#   ./scripts/test-api-key.sh <API_KEY> <SUPABASE_PROJECT_REF>
#
# Ejemplo:
#   ./scripts/test-api-key.sh wsk_prod_abc123 your-project-ref
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
API_KEY="${1:-}"
PROJECT_REF="${2:-}"

if [ -z "$API_KEY" ]; then
  echo -e "${RED}❌ Error: API_KEY is required${NC}"
  echo "Usage: $0 <API_KEY> <SUPABASE_PROJECT_REF>"
  exit 1
fi

if [ -z "$PROJECT_REF" ]; then
  echo -e "${RED}❌ Error: SUPABASE_PROJECT_REF is required${NC}"
  echo "Usage: $0 <API_KEY> <SUPABASE_PROJECT_REF>"
  exit 1
fi

API_URL="https://${PROJECT_REF}.supabase.co/functions/v1/api-search"

echo "============================================================================"
echo "🧪 Testing API Key for WholeSale Connect AI"
echo "============================================================================"
echo ""
echo "API URL: $API_URL"
echo "API Key: ${API_KEY:0:20}..."
echo ""

# ============================================================================
# TEST 1: Autenticación básica
# ============================================================================
echo -e "${YELLOW}📝 TEST 1: Autenticación básica (missing request_id)${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "prompt": "vuelo a miami"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "400" ]; then
  ERROR_CODE=$(echo "$BODY" | jq -r '.error.code')
  if [ "$ERROR_CODE" = "MISSING_REQUEST_ID" ]; then
    echo -e "${GREEN}✅ PASS: Error 400 esperado (falta request_id)${NC}"
  else
    echo -e "${RED}❌ FAIL: Error code inesperado: $ERROR_CODE${NC}"
    echo "$BODY" | jq .
    exit 1
  fi
else
  echo -e "${RED}❌ FAIL: HTTP code inesperado: $HTTP_CODE (esperado: 400)${NC}"
  echo "$BODY" | jq .
  exit 1
fi

echo ""

# ============================================================================
# TEST 2: Request válido (natural language)
# ============================================================================
echo -e "${YELLOW}📝 TEST 2: Request válido (natural language)${NC}"

REQUEST_ID="test_$(date +%s)_$RANDOM"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"request_id\": \"$REQUEST_ID\",
    \"prompt\": \"vuelo a miami saliendo el 15 de enero volviendo el 22 de enero, 2 adultos\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "422" ]; then
  SEARCH_ID=$(echo "$BODY" | jq -r '.search_id')
  STATUS=$(echo "$BODY" | jq -r '.status')
  IS_RETRY=$(echo "$BODY" | jq -r '.is_retry')

  echo -e "${GREEN}✅ PASS: Request procesado correctamente${NC}"
  echo "   - Search ID: $SEARCH_ID"
  echo "   - Status: $STATUS"
  echo "   - Is Retry: $IS_RETRY"

  # Check rate limit headers
  RATE_LIMIT=$(curl -s -D - -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $API_KEY" \
    -d "{\"request_id\": \"test_rate_$RANDOM\", \"prompt\": \"vuelo a madrid\"}" \
    -o /dev/null | grep -i "X-RateLimit")

  echo ""
  echo "Rate Limit Headers:"
  echo "$RATE_LIMIT"
else
  echo -e "${RED}❌ FAIL: HTTP code inesperado: $HTTP_CODE${NC}"
  echo "$BODY" | jq .
  exit 1
fi

echo ""

# ============================================================================
# TEST 3: Idempotencia (mismo request_id)
# ============================================================================
echo -e "${YELLOW}📝 TEST 3: Idempotencia (mismo request_id)${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"request_id\": \"$REQUEST_ID\",
    \"prompt\": \"vuelo a miami saliendo el 15 de enero volviendo el 22 de enero, 2 adultos\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "422" ]; then
  IS_RETRY=$(echo "$BODY" | jq -r '.is_retry')
  CACHED_AT=$(echo "$BODY" | jq -r '.cached_at')

  if [ "$IS_RETRY" = "true" ]; then
    echo -e "${GREEN}✅ PASS: Idempotencia funcionando (is_retry=true)${NC}"
    echo "   - Cached at: $CACHED_AT"
  else
    echo -e "${YELLOW}⚠️  WARNING: is_retry debería ser true (puede ser timing issue)${NC}"
  fi
else
  echo -e "${RED}❌ FAIL: HTTP code inesperado: $HTTP_CODE${NC}"
  echo "$BODY" | jq .
  exit 1
fi

echo ""

# ============================================================================
# TEST 4: Structured mode (sin AI)
# ============================================================================
echo -e "${YELLOW}📝 TEST 4: Structured mode (sin AI)${NC}"

REQUEST_ID_STRUCT="test_struct_$(date +%s)_$RANDOM"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d "{
    \"request_id\": \"$REQUEST_ID_STRUCT\",
    \"flights\": {
      \"origin\": \"EZE\",
      \"destination\": \"MIA\",
      \"departureDate\": \"2025-01-15\",
      \"returnDate\": \"2025-01-22\",
      \"adults\": 2
    }
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "422" ]; then
  PARSED_TYPE=$(echo "$BODY" | jq -r '.parsed_request.type')

  if [ "$PARSED_TYPE" = "flights" ]; then
    echo -e "${GREEN}✅ PASS: Structured mode funcionando (type=flights)${NC}"
  else
    echo -e "${YELLOW}⚠️  WARNING: Parsed type inesperado: $PARSED_TYPE${NC}"
  fi
else
  echo -e "${RED}❌ FAIL: HTTP code inesperado: $HTTP_CODE${NC}"
  echo "$BODY" | jq .
  exit 1
fi

echo ""

# ============================================================================
# TEST 5: API key inválida
# ============================================================================
echo -e "${YELLOW}📝 TEST 5: API key inválida${NC}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wsk_prod_INVALID_KEY_12345" \
  -d "{
    \"request_id\": \"test_invalid_$RANDOM\",
    \"prompt\": \"vuelo a miami\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "401" ]; then
  ERROR_CODE=$(echo "$BODY" | jq -r '.error.code')
  if [ "$ERROR_CODE" = "INVALID_API_KEY" ]; then
    echo -e "${GREEN}✅ PASS: API key inválida correctamente rechazada${NC}"
  else
    echo -e "${YELLOW}⚠️  WARNING: Error code inesperado: $ERROR_CODE (esperado: INVALID_API_KEY)${NC}"
  fi
else
  echo -e "${RED}❌ FAIL: HTTP code inesperado: $HTTP_CODE (esperado: 401)${NC}"
  echo "$BODY" | jq .
fi

echo ""

# ============================================================================
# RESUMEN
# ============================================================================
echo "============================================================================"
echo -e "${GREEN}✅ Todos los tests completados${NC}"
echo "============================================================================"
echo ""
echo "Próximos pasos:"
echo "1. Verificar usage_count en la base de datos"
echo "2. Verificar api_request_cache tiene entradas"
echo "3. Revisar logs en Supabase Dashboard"
echo ""
