#!/bin/bash
# Fix: despliega solo los resolvers que fallaron
# Usa update-resolver en vez de create-resolver porque ya existen parcialmente

API_ID="s2kktydww5bd7fwzycilwmqlfm"
REGION="us-east-1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOLVERS_DIR="$SCRIPT_DIR/resolvers"

DS_SESSION="SessionTable"
DS_GAME="GameTable"
DS_BET="BetTable"
DS_CONVERSATION="ConversationTable"

create_or_update_resolver() {
  local TYPE_NAME=$1
  local FIELD_NAME=$2
  local DATA_SOURCE=$3
  local CODE_FILE=$4

  echo "  → $TYPE_NAME.$FIELD_NAME ($DATA_SOURCE)"

  # Intentar crear primero
  RESULT=$(aws appsync create-resolver \
    --api-id "$API_ID" \
    --type-name "$TYPE_NAME" \
    --field-name "$FIELD_NAME" \
    --data-source-name "$DATA_SOURCE" \
    --runtime '{"name":"APPSYNC_JS","runtimeVersion":"1.0.0"}' \
    --code "$(cat "$RESOLVERS_DIR/$CODE_FILE")" \
    --region "$REGION" \
    --no-cli-pager 2>&1)

  if echo "$RESULT" | grep -q "ConcurrentModificationException\|already exists"; then
    # Ya existe, actualizar
    RESULT=$(aws appsync update-resolver \
      --api-id "$API_ID" \
      --type-name "$TYPE_NAME" \
      --field-name "$FIELD_NAME" \
      --data-source-name "$DATA_SOURCE" \
      --runtime '{"name":"APPSYNC_JS","runtimeVersion":"1.0.0"}' \
      --code "$(cat "$RESOLVERS_DIR/$CODE_FILE")" \
      --region "$REGION" \
      --no-cli-pager 2>&1)
  fi

  if echo "$RESULT" | grep -q "resolverArn"; then
    echo "    ✅ OK"
  else
    echo "    ❌ ERROR: $RESULT"
  fi
}

echo "============================================="
echo " Corrigiendo resolvers que fallaron"
echo "============================================="
echo ""

echo "📖 Queries (list):"
create_or_update_resolver "Query" "listSessions" "$DS_SESSION" "listItems.js"
create_or_update_resolver "Query" "listGames" "$DS_GAME" "listItems.js"
create_or_update_resolver "Query" "listBets" "$DS_BET" "listItems.js"
create_or_update_resolver "Query" "listConversations" "$DS_CONVERSATION" "listItems.js"

echo ""
echo "✏️  Mutations (update):"
create_or_update_resolver "Mutation" "updateSession" "$DS_SESSION" "updateItem.js"
create_or_update_resolver "Mutation" "updateConversation" "$DS_CONVERSATION" "updateItem.js"

echo ""
echo "✅ Done"
