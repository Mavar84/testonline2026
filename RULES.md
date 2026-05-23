# Rules

## Regla global obligatoria

- Todo debe funcionar dentro de Docker.
- No ejecutar servicios en el host.
- No romper `docker-compose.yml`.
- No agregar dependencias que requieran ejecucion fuera de contenedor.
- Si se agrega un servicio nuevo, debe entrar como contenedor.

## Backend

- Respetar estructura por app: `core`, `items`, `pruebas`, `respuestas`, `usuarios`.
- Reutilizar patrones existentes de DRF (`ViewSet`, `Serializer`, `urls.py`).
- Leer configuracion desde variables de entorno.
- Si un cambio toca documentos, mantener blob como fuente oficial.
- Si toca biometria, mantener `faceauth` como servicio separado.

## Frontend

- Mantener React + Vite + Axios existentes.
- Consumir API mediante `src/services/api.js`.
- No hardcodear nuevos endpoints fuera del servicio si no es necesario.
- Seguir rutas ya organizadas por perfil y modulo.

## Nuevas funcionalidades

- Leer primero `AI_CONTEXT.md`.
- Integrar DB, API y frontend sin romper Docker.
- Si requiere proceso aparte, usar contenedor dedicado.

## Documentacion

- Actualizar solo el `.md` afectado.
- Evitar duplicar contexto.
