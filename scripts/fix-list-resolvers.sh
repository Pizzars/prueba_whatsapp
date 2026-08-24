#!/bin/bash
# Actualiza los resolvers de list para soportar filtros
API_ID="s2kktydww5bd7fwzycilwmqlfm"
REGION="us-east-1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOLVERS_DIR="$SCRIPT_DIR/resolvers"

echo "Actualizando resolvers de list con soporte de filtros..."

declare -A FIELDS
FIELDS[listSessions]="SessionTable"
FIELDS[listGames]="GameTable"
FIELDS[listBets]="BetTable"
FIELDS[listConversations]="ConversationTable"

for FIELD in "${!FIELDS[@]}"; do
  DS="${FIELDS[$FIELD]}"
  echo "  → Query.$FIELD ($DS)"
  aws appsync update-resolver \
    --api-id "$API_ID" \
    --type-name "Query" \
    --field-name "$FIELD" \
    --data-source-name "$DS" \
    --runtime '{"name":"APPSYNC_JS","runtimeVersion":"1.0.0"}' \
    --code "$(cat "$RESOLVERS_DIR/listItems.js")" \
    --region "$REGION" \
    --no-cli-pager 2>&1 | grep -q "resolverArn" && echo "    ✅ OK" || echo "    ❌ ERROR"
done

echo ""
echo "Done."
