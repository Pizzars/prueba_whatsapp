#!/bin/bash
# Actualiza el schema de AppSync con el archivo schema.graphql del proyecto
# Ejecutar: bash scripts/update-schema.sh

API_ID="s2kktydww5bd7fwzycilwmqlfm"
REGION="us-east-1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCHEMA_FILE="$SCRIPT_DIR/../schema.graphql"

echo "Actualizando schema en AppSync..."
echo "  API: $API_ID"
echo "  Archivo: $SCHEMA_FILE"
echo ""

# Codificar schema en base64
SCHEMA_B64=$(base64 < "$SCHEMA_FILE")

aws appsync start-schema-creation \
  --api-id "$API_ID" \
  --definition "$SCHEMA_B64" \
  --region "$REGION" \
  --no-cli-pager 2>&1

if [ $? -eq 0 ]; then
  echo ""
  echo "⏳ Schema enviado. Verificando estado..."
  sleep 3

  STATUS=$(aws appsync get-schema-creation-status \
    --api-id "$API_ID" \
    --region "$REGION" \
    --query "status" \
    --output text \
    --no-cli-pager 2>&1)

  echo "  Estado: $STATUS"

  if [ "$STATUS" = "SUCCESS" ]; then
    echo "✅ Schema actualizado correctamente."
  elif [ "$STATUS" = "PROCESSING" ]; then
    echo "⏳ Aún procesando. Verifica en la consola de AppSync."
  else
    echo "❌ Error. Revisa la consola de AppSync para más detalles."
    aws appsync get-schema-creation-status \
      --api-id "$API_ID" \
      --region "$REGION" \
      --no-cli-pager 2>&1
  fi
else
  echo "❌ Error enviando el schema."
fi
