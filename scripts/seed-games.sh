#!/bin/bash
# Inserta los 2 juegos de prueba en la tabla Game_prueba_whatsapp
# Ejecutar: bash scripts/seed-games.sh

REGION="us-east-1"
TABLE="Game_prueba_whatsapp"

echo "Insertando juegos en $TABLE..."

aws dynamodb put-item \
  --table-name "$TABLE" \
  --item '{
    "id": {"S": "loteria-nacional"},
    "name": {"S": "Lotería Nacional"},
    "description": {"S": "Sorteos cada hora. Escoge tu número de 4 cifras y gana."},
    "icon": {"S": "🎰"}
  }' \
  --region "$REGION"

echo "  ✅ Lotería Nacional"

aws dynamodb put-item \
  --table-name "$TABLE" \
  --item '{
    "id": {"S": "chance-express"},
    "name": {"S": "Chance Express"},
    "description": {"S": "Apuesta rápida. Resultados al instante cada hora."},
    "icon": {"S": "⚡"}
  }' \
  --region "$REGION"

echo "  ✅ Chance Express"
echo ""
echo "🎲 Seed completado."
