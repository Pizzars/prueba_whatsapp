#!/bin/bash
# Crea las 4 tablas DynamoDB para la demo
# Ejecutar: bash scripts/create-tables.sh

REGION="us-east-1"

echo "Creando tabla Session_prueba_whatsapp..."
aws dynamodb create-table \
  --table-name Session_prueba_whatsapp \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION

echo "Creando tabla Game_prueba_whatsapp..."
aws dynamodb create-table \
  --table-name Game_prueba_whatsapp \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION

echo "Creando tabla Bet_prueba_whatsapp..."
aws dynamodb create-table \
  --table-name Bet_prueba_whatsapp \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION

echo "Creando tabla Conversation_prueba_whatsapp..."
aws dynamodb create-table \
  --table-name Conversation_prueba_whatsapp \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION

echo "✅ Tablas creadas. Verifica en la consola de DynamoDB."
