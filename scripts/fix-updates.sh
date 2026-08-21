#!/bin/bash
API_ID="s2kktydww5bd7fwzycilwmqlfm"
REGION="us-east-1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOLVERS_DIR="$SCRIPT_DIR/resolvers"

echo "Fixing update resolvers..."

echo "  → Mutation.updateSession"
aws appsync create-resolver \
  --api-id "$API_ID" \
  --type-name "Mutation" \
  --field-name "updateSession" \
  --data-source-name "SessionTable" \
  --runtime '{"name":"APPSYNC_JS","runtimeVersion":"1.0.0"}' \
  --code "$(cat "$RESOLVERS_DIR/updateItem.js")" \
  --region "$REGION" \
  --no-cli-pager --cli-error-format json 2>&1

echo ""
echo "  → Mutation.updateConversation"
aws appsync create-resolver \
  --api-id "$API_ID" \
  --type-name "Mutation" \
  --field-name "updateConversation" \
  --data-source-name "ConversationTable" \
  --runtime '{"name":"APPSYNC_JS","runtimeVersion":"1.0.0"}' \
  --code "$(cat "$RESOLVERS_DIR/updateItem.js")" \
  --region "$REGION" \
  --no-cli-pager --cli-error-format json 2>&1

echo ""
echo "Done."
