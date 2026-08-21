#!/bin/bash
# =============================================================
# Script para crear todos los resolvers de AppSync
# =============================================================
# PREREQUISITOS:
# 1. AWS CLI instalado y configurado (aws configure)
# 2. Las 4 tablas DynamoDB ya creadas
# 3. Los 4 Data Sources ya creados en AppSync
#
# ANTES DE EJECUTAR:
# - Ajusta API_ID con el ID de tu API de AppSync
# - Ajusta los nombres de data sources si los cambiaste
# =============================================================

API_ID="s2kktydww5bd7fwzycilwmqlfm"
REGION="us-east-1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOLVERS_DIR="$SCRIPT_DIR/resolvers"

# Data source names (los que creaste en AppSync)
DS_SESSION="SessionTable"
DS_GAME="GameTable"
DS_BET="BetTable"
DS_CONVERSATION="ConversationTable"

# Función helper para crear resolver
create_resolver() {
  local TYPE_NAME=$1
  local FIELD_NAME=$2
  local DATA_SOURCE=$3
  local CODE_FILE=$4

  echo "  → $TYPE_NAME.$FIELD_NAME ($DATA_SOURCE)"

  aws appsync create-resolver \
    --api-id "$API_ID" \
    --type-name "$TYPE_NAME" \
    --field-name "$FIELD_NAME" \
    --data-source-name "$DATA_SOURCE" \
    --runtime '{"name":"APPSYNC_JS","runtimeVersion":"1.0.0"}' \
    --code "$(cat "$RESOLVERS_DIR/$CODE_FILE")" \
    --region "$REGION" \
    --no-cli-pager 2>&1

  if [ $? -eq 0 ]; then
    echo "    ✅ OK"
  else
    echo "    ❌ ERROR"
  fi
}

echo "============================================="
echo " Desplegando resolvers de AppSync"
echo " API: $API_ID | Región: $REGION"
echo "============================================="
echo ""

# --- QUERIES ---
echo "📖 Queries:"
create_resolver "Query" "getSession" "$DS_SESSION" "getItem.js"
create_resolver "Query" "listSessions" "$DS_SESSION" "listItems.js"
create_resolver "Query" "getGame" "$DS_GAME" "getItem.js"
create_resolver "Query" "listGames" "$DS_GAME" "listItems.js"
create_resolver "Query" "getBet" "$DS_BET" "getItem.js"
create_resolver "Query" "listBets" "$DS_BET" "listItems.js"
create_resolver "Query" "getConversation" "$DS_CONVERSATION" "getItem.js"
create_resolver "Query" "listConversations" "$DS_CONVERSATION" "listItems.js"

echo ""

# --- MUTATIONS ---
echo "✏️  Mutations:"
create_resolver "Mutation" "createSession" "$DS_SESSION" "createItem.js"
create_resolver "Mutation" "updateSession" "$DS_SESSION" "updateItem.js"
create_resolver "Mutation" "deleteSession" "$DS_SESSION" "deleteItem.js"
create_resolver "Mutation" "createGame" "$DS_GAME" "createItem.js"
create_resolver "Mutation" "createBet" "$DS_BET" "createItem.js"
create_resolver "Mutation" "createConversation" "$DS_CONVERSATION" "createItem.js"
create_resolver "Mutation" "updateConversation" "$DS_CONVERSATION" "updateItem.js"

echo ""
echo "============================================="
echo " ✅ Resolvers desplegados"
echo "============================================="
echo ""
echo "Prueba en la consola de AppSync → Queries para verificar."
