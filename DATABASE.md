# Database

- Motor: PostgreSQL 16
- Contenedor: `postgres`
- Backend conecta con `DB_HOST=postgres`

Tablas principales:
- `auth_user`, `usuarios_perfilusuario`
- `core_*`
- `items_*`
- `pruebas_*`
- `respuestas_*`

Reglas:
- Datos relacionales en PostgreSQL
- Documentos en blob, no en BD
- No usar PostgreSQL del host
