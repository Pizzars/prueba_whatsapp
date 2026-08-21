# Configuración de AppSync + DynamoDB con AWS CLI

Guía para crear toda la infraestructura del API GraphQL desde cero usando AWS CLI.

---

## Prerequisitos

1. **AWS CLI** instalado y configurado:
   ```bash
   brew install awscli
   aws configure
   ```
   - Access Key ID: tu key de IAM
   - Secret Access Key: tu secret de IAM
   - Region: `us-east-1`
   - Output: `json`

2. **Permisos IAM** necesarios para el usuario:
   - `AmazonDynamoDBFullAccess`
   - `AWSAppSyncAdministrator`

3. Verificar que funciona:
   ```bash
   aws sts get-caller-identity
   ```

---

## Paso 1: Crear las tablas DynamoDB

```bash
bash scripts/create-tables.sh
```

Esto crea 4 tablas con billing On-demand:

| Tabla | Partition Key |
|-------|--------------|
| `Session_prueba_whatsapp` | `id` (String) |
| `Game_prueba_whatsapp` | `id` (String) |
| `Bet_prueba_whatsapp` | `id` (String) |
| `Conversation_prueba_whatsapp` | `id` (String) |

---

## Paso 2: Crear la API en AppSync (consola)

1. Ve a AWS Console → **AppSync** → **Create API**
2. Selecciona **Build from scratch** (GraphQL)
3. Nombre: `prueba-whatsapp-api`
4. Auth mode: **API Key**
5. Crea la API

Toma nota del **API ID** (lo necesitas para los scripts).

---

## Paso 3: Subir el schema

Copia el contenido de `schema.graphql` y pégalo en AppSync → **Schema** → **Save Schema**.

El schema es GraphQL puro (sin directivas `@model`). Incluye:
- 4 types principales
- Inputs para crear/actualizar
- Filter inputs para queries
- Connection types con paginación
- Queries, Mutations y Subscriptions

---

## Paso 4: Crear los Data Sources (consola)

En AppSync → **Data Sources** → **Create data source**, crea 4:

| Nombre | Tipo | Tabla DynamoDB |
|--------|------|----------------|
| `SessionTable` | Amazon DynamoDB | `Session_prueba_whatsapp` |
| `GameTable` | Amazon DynamoDB | `Game_prueba_whatsapp` |
| `BetTable` | Amazon DynamoDB | `Bet_prueba_whatsapp` |
| `ConversationTable` | Amazon DynamoDB | `Conversation_prueba_whatsapp` |

En cada uno:
- Region: `us-east-1`
- **No** habilitar control de versiones
- **No** activar generación automática de GraphQL
- Dejar que AppSync cree el IAM Role automáticamente

---

## Paso 5: Desplegar los resolvers

Antes de ejecutar, edita `scripts/deploy-resolvers.sh` y verifica que el `API_ID` sea el correcto:

```bash
API_ID="tu-api-id-aqui"
```

Luego ejecuta:

```bash
bash scripts/deploy-resolvers.sh
```

### Notas sobre los resolvers

Hay 3 tipos de resolver usados:

**getItem.js** — Para queries de un solo item (GetItem por ID):
```javascript
import { util } from "@aws-appsync/utils";

export function request(ctx) {
  return {
    operation: "GetItem",
    key: util.dynamodb.toMapValues({ id: ctx.args.id }),
  };
}

export function response(ctx) {
  return ctx.result;
}
```

**listItems.js** — Para queries de lista (Scan):
```javascript
import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const { filter, limit, nextToken } = ctx.args;
  const scanRequest = {
    operation: "Scan",
    limit: limit || 50,
  };
  if (nextToken) {
    scanRequest.nextToken = nextToken;
  }
  return scanRequest;
}

export function response(ctx) {
  return {
    items: ctx.result.items,
    nextToken: ctx.result.nextToken || null,
  };
}
```

**createItem.js** — Para mutations de creación (PutItem):
```javascript
import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const item = { ...ctx.args.input };
  if (!item.id) {
    item.id = util.autoId();
  }
  return {
    operation: "PutItem",
    key: util.dynamodb.toMapValues({ id: item.id }),
    attributeValues: util.dynamodb.toMapValues(item),
  };
}

export function response(ctx) {
  return ctx.result;
}
```

**updateItem.js** — Para mutations de actualización (UpdateItem):
```javascript
import { util } from '@aws-appsync/utils';
import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { id, ...values } = ctx.args.input;
  return ddb.update({
    key: { id },
    update: values,
  });
}

export function response(ctx) {
  return ctx.result;
}
```

> **Importante**: El resolver de update usa el módulo `@aws-appsync/utils/dynamodb` con el helper `ddb.update()`. No usar `Object.entries()` ni construir expresiones manualmente — el runtime JS de AppSync no soporta todas las APIs de ES6. El helper `ddb.update()` genera las expresiones automáticamente.

**deleteItem.js** — Para mutations de eliminación (DeleteItem):
```javascript
import { util } from "@aws-appsync/utils";

export function request(ctx) {
  return {
    operation: "DeleteItem",
    key: util.dynamodb.toMapValues({ id: ctx.args.input.id }),
  };
}

export function response(ctx) {
  return ctx.result;
}
```

### Si algún resolver falla

El script `deploy-resolvers.sh` usa `create-resolver`. Si un resolver ya existe y necesitas actualizarlo, usa `update-resolver` con los mismos parámetros:

```bash
aws appsync update-resolver \
  --api-id "TU_API_ID" \
  --type-name "Mutation" \
  --field-name "updateSession" \
  --data-source-name "SessionTable" \
  --runtime '{"name":"APPSYNC_JS","runtimeVersion":"1.0.0"}' \
  --code "$(cat scripts/resolvers/updateItem.js)" \
  --region us-east-1 \
  --no-cli-pager
```

Para ver el error completo de un resolver, agrega `--cli-error-format json` al comando.

---

## Paso 6: Seed de datos iniciales

```bash
bash scripts/seed-games.sh
```

Inserta los 2 juegos de prueba en la tabla `Game_prueba_whatsapp`.

---

## Paso 7: Verificar

En la consola de AppSync → **Queries**, ejecuta:

```graphql
query {
  listGames {
    items {
      id
      name
      description
      icon
    }
  }
}
```

Resultado esperado:
```json
{
  "data": {
    "listGames": {
      "items": [
        {
          "id": "loteria-nacional",
          "name": "Lotería Nacional",
          "description": "Sorteos cada hora. Escoge tu número de 4 cifras y gana.",
          "icon": "🎰"
        },
        {
          "id": "chance-express",
          "name": "Chance Express",
          "description": "Apuesta rápida. Resultados al instante cada hora.",
          "icon": "⚡"
        }
      ]
    }
  }
}
```

---

## Resumen de resolvers desplegados

### Queries (8)

| Field | Data Source | Resolver |
|-------|------------|----------|
| `getSession` | SessionTable | getItem.js |
| `listSessions` | SessionTable | listItems.js |
| `getGame` | GameTable | getItem.js |
| `listGames` | GameTable | listItems.js |
| `getBet` | BetTable | getItem.js |
| `listBets` | BetTable | listItems.js |
| `getConversation` | ConversationTable | getItem.js |
| `listConversations` | ConversationTable | listItems.js |

### Mutations (7)

| Field | Data Source | Resolver |
|-------|------------|----------|
| `createSession` | SessionTable | createItem.js |
| `updateSession` | SessionTable | updateItem.js |
| `deleteSession` | SessionTable | deleteItem.js |
| `createGame` | GameTable | createItem.js |
| `createBet` | BetTable | createItem.js |
| `createConversation` | ConversationTable | createItem.js |
| `updateConversation` | ConversationTable | updateItem.js |

---

## Limitaciones del runtime JS de AppSync

- No soporta `Object.entries()`, `Object.keys()`, `Array.from()` en contextos complejos
- No soporta `async/await`
- No soporta módulos externos (solo `@aws-appsync/utils` y `@aws-appsync/utils/dynamodb`)
- Para updates dinámicos, usar `ddb.update()` del módulo `@aws-appsync/utils/dynamodb`
- Para filtros complejos en scans, es mejor manejar el filtrado en la capa de aplicación (API Routes de Next.js)

---

## Limpieza

Para eliminar todo después de las pruebas, busca tablas y recursos con `_prueba_whatsapp` en el nombre:

```bash
# Eliminar tablas
aws dynamodb delete-table --table-name Session_prueba_whatsapp --region us-east-1
aws dynamodb delete-table --table-name Game_prueba_whatsapp --region us-east-1
aws dynamodb delete-table --table-name Bet_prueba_whatsapp --region us-east-1
aws dynamodb delete-table --table-name Conversation_prueba_whatsapp --region us-east-1

# Eliminar la API de AppSync
aws appsync delete-graphql-api --api-id TU_API_ID --region us-east-1
```
