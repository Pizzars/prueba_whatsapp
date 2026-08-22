# Usuarios de Prueba

Usuarios hardcoded para la plataforma de apuestas. El login se realiza con el número de documento y contraseña.

| Nombre | Documento | Contraseña |
|--------|-----------|------------|
| Carlos Martínez | 1023456789 | 1234567890 |
| María López | 1098765432 | 1234567890 |
| Andrés García | 1045678901 | 1234567890 |
| Laura Rodríguez | 1067890123 | 1234567890 |

## Notas
- La contraseña es la misma para todos: `1234567890`
- El login también solicita la ubicación del dispositivo (geolocalización).
- El saldo es ficticio y no se descuenta al apostar (plataforma de pruebas, el pago siempre es exitoso).
- Estos usuarios están definidos en el código fuente en `app/lib/users.ts`.
