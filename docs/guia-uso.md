# Guía de Uso - Plataforma de Apuestas + WhatsApp

## URL de la app
```
https://main.d1bz5bsylv88le.amplifyapp.com
```

---

## Páginas disponibles

| Ruta | Descripción |
|------|-------------|
| `/` | Dashboard de juegos y apuestas |
| `/login` | Inicio de sesión |
| `/login/success` | Confirmación post-login (flujo WhatsApp) |
| `/config` | Configuración de WhatsApp (token, phone ID, etc.) |
| `/monitor` | Monitoreo de sesiones y conversaciones |

---

## Flujo Web (plataforma directa)

1. Ir a `/login`
2. Ingresar documento de un usuario de prueba (ej: `1023456789`)
3. Ingresar contraseña: `1234567890`
4. Aceptar el permiso de ubicación del navegador
5. Se crea la sesión y redirige al dashboard
6. Seleccionar un juego → seleccionar sorteo → ingresar número (4 cifras) → ingresar monto ($500-$2000) → Pagar
7. Ver historial en la pestaña "Mis apuestas"

---

## Flujo WhatsApp

### Configuración previa

1. Ir a `/config` y verificar que estén configurados:
   - Token de WhatsApp (se obtiene en Meta for Developers)
   - Phone Number ID
   - Verify Token (el mismo que se puso en Meta al configurar el webhook)
   - Número de pruebas (con código de país, ej: `573114770120`)

2. El webhook debe estar configurado en Meta:
   - **Callback URL:** `https://main.d1bz5bsylv88le.amplifyapp.com/api/whatsapp/webhook`
   - **Verify Token:** el mismo que se configuró en `/config`
   - **Suscripciones:** messages

### Interacción paso a paso

1. **Usuario envía cualquier mensaje** al número de WhatsApp Business
2. **Bot ofrece 2 opciones** (botones interactivos):
   - "Ingresar con URL" → login via navegador
   - "Usuario y contraseña" → login directamente por chat
3. **Opción URL:** bot envía URL, usuario hace login en la web, bot detecta automáticamente y envía menú
4. **Opción credenciales:** bot pide ubicación → documento (10 dígitos) → contraseña → login
5. **Menú principal** — una vez con sesión activa:
   - `1` → Ver juegos disponibles
   - `2` → Hacer una apuesta (juego → sorteo → número → monto)
   - `3` → Ver mis apuestas
   - `4` → Cerrar sesión
   - `menu` → Volver al menú en cualquier momento
   - `terminar` → Cerrar sesión desde cualquier estado

### Probar envío de mensajes

Desde `/config`, usa el botón "Enviar mensaje de prueba" para verificar que la conexión con la API de WhatsApp funciona correctamente.

---

## Monitoreo

En `/monitor` puedes ver en tiempo real:
- **Conversaciones WhatsApp:** número de teléfono, estado actual del flujo (con etiquetas legibles y colores), progreso de apuesta
- **Sesiones activas (tab):** nombre, documento, ubicación, vigencia (expira en Xm), hora de creación
- **Historial (tab):** sesiones cerradas o expiradas

Funciones:
- **Refrescar**: actualiza los datos según el tab seleccionado
- **Cerrar todas**: cierra todas las sesiones activas, notifica por WhatsApp a los usuarios asociados

---

## Notas importantes

- Los tokens de WhatsApp temporales duran **24 horas**. Si dejan de funcionar, genera uno nuevo en Meta y actualízalo desde `/config`.
- La app debe estar **publicada** en Meta para recibir webhooks de usuarios reales. En modo desarrollo, solo los números agregados como testers reciben/envían mensajes.
- Las sesiones de usuario expiran en **1 hora**.
- Los pagos son siempre exitosos (plataforma de pruebas).
- WhatsApp Flows (formularios nativos) requieren Business Portfolio verificado. Mientras tanto se usa login por texto paso a paso.
- La configuración de WhatsApp se guarda en DynamoDB — se puede cambiar desde `/config` sin redesplegar.
- Desde `/monitor` se pueden cerrar todas las sesiones activas de una vez (notifica a los usuarios por WhatsApp).
- Para ver documentación detallada de la integración WhatsApp, ver `docs/whatsapp-integracion.md`.
