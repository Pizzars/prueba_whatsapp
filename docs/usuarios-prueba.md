# Usuarios de Prueba

Usuarios hardcoded para la plataforma de apuestas. El login se realiza con el número de documento (10 dígitos).

| Nombre | Documento | Saldo (ficticio) |
|--------|-----------|-------------------|
| Carlos Martínez | 1023456789 | $50.000 |
| María López | 1098765432 | $50.000 |
| Andrés García | 1045678901 | $50.000 |
| Laura Rodríguez | 1067890123 | $50.000 |

## Notas
- No hay contraseña. El login solo requiere el número de documento.
- El saldo es ficticio y no se descuenta al apostar (plataforma de pruebas, el pago siempre es exitoso).
- Estos usuarios están definidos en el código fuente en `app/lib/users.ts`.
