# Guía de Deploy

## Pasos para poner todo en producción

---

## 1. Actualizar Schema en AppSync

El schema tiene campos nuevos (`documento`, `nombre`, filtro `token`). Actualízalo:

```bash
bash scripts/update-schema.sh
```

O manualmente: copia el contenido de `schema.graphql` → AppSync Console → Schema → Save.

---

## 2. Variables de Entorno en Amplify

Ve a AWS Amplify Console → tu app → **Hosting** → **Environment variables** y agrega:

| Variable | Valor |
|----------|-------|
| `APPSYNC_ENDPOINT` | `https://nacdrra6kvcgdgfl6vvrvxbs5i.appsync-api.us-east-1.amazonaws.com/graphql` |
| `APPSYNC_API_KEY` | `da2-hkrvgcesznby3dxfbuedq5gepy` |
| `AWS_REGION` | `us-east-1` |
| `WHATSAPP_TOKEN` | Token permanente de WhatsApp Business API |
| `WHATSAPP_VERIFY_TOKEN` | Token personalizado para verificar el webhook (inventalo tú) |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de WhatsApp Business |
| `NEXT_PUBLIC_APP_URL` | URL de tu app en Amplify (ej: `https://main.d1abc123.amplifyapp.com`) |

---

## 3. Configurar WhatsApp Business API

### En Meta for Developers (developers.facebook.com):

1. Crea una app de tipo Business
2. Agrega el producto "WhatsApp"
3. En **WhatsApp** → **Configuration** → **Webhook**:
   - URL: `https://tu-app.amplifyapp.com/api/whatsapp/webhook`
   - Verify Token: el mismo que pusiste en `WHATSAPP_VERIFY_TOKEN`
   - Suscripciones: marca `messages`
4. En **WhatsApp** → **API Setup**:
   - Copia el **Phone Number ID** → ponlo en `WHATSAPP_PHONE_NUMBER_ID`
   - Genera un **Permanent Token** → ponlo en `WHATSAPP_TOKEN`

---

## 4. Seed de Juegos (si no lo hiciste)

```bash
bash scripts/seed-games.sh
```

---

## 5. Verificar Deploy

Después de que Amplify termine el build:

1. **Login web**: Ve a `https://tu-app.amplifyapp.com/login` → ingresa documento `1023456789` → debe pedir ubicación → debe crear sesión
2. **Dashboard**: Debe mostrar juegos, sorteos, formulario de apuesta
3. **Webhook**: En Meta Console → WhatsApp → Webhook → "Test" → verifica que responda 200
4. **Flujo WhatsApp**: Envía un mensaje al número → debe recibir enlace de login

---

## Troubleshooting

### "Error interno del servidor" en login
- Verifica que `APPSYNC_ENDPOINT` y `APPSYNC_API_KEY` estén configurados en Amplify
- Verifica que el schema en AppSync tenga los campos `documento` y `nombre`

### Webhook no responde
- Verifica que `WHATSAPP_VERIFY_TOKEN` en Amplify coincida con el de Meta
- La URL del webhook debe ser HTTPS (Amplify lo da automáticamente)

### "Sesión inválida" 
- Las sesiones expiran en 24h
- Verifica que el filtro `token` esté en el schema (`TableSessionFilterInput`)

### Mensajes de WhatsApp no se envían
- Verifica `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`
- En Meta Console, el número de test solo puede enviar a números verificados durante desarrollo
