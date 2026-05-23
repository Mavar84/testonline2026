# AI Context

## Leer primero

1. `AI_CONTEXT.md`
2. `RULES.md`
3. `ARCHITECTURE.md`
4. archivo del modulo a tocar

## Regla clave

Todo corre en Docker.  
No proponer ni implementar ejecucion fuera de contenedores.  
Cualquier servicio nuevo debe integrarse a `docker-compose.yml`.

## Proyecto

Sistema de evaluacion en linea con:
- estructura curricular
- banco de items
- pruebas por partes
- asignacion a estudiantes
- resolucion y calificacion

## Stack

- Django + DRF + JWT
- React + Vite
- PostgreSQL
- Azurite
- FastAPI + InsightFace
- Docker Compose

## Estructura

- `core/`: programas, subareas, subtemas, resultados
- `items/`: tipos de item y documentos
- `pruebas/`: pruebas, partes, asignaciones
- `respuestas/`: intentos, envio, revision
- `usuarios/`: perfil, registro, biometria
- `front_react/frontend/`: UI React
- `face_service/`: servicio facial

## Reglas de modificacion

- Si tocas documentos: mantener blob como fuente oficial.
- Si tocas biometria: mantener `faceauth` separado.
- Si tocas frontend: usar `src/services/api.js`.
- Si tocas backend: seguir patrones DRF existentes.

## Flujo base

Profesor crea prueba -> asigna estudiantes -> estudiante valida acceso/rostro -> resuelve examen -> envia respuestas -> profesor revisa/califica -> estudiante ve revision.

## Archivos utiles por tipo de cambio

- Docker/infra: `docker-compose.yml`, `ARCHITECTURE.md`
- API: `config/urls.py`, `*/urls.py`, `*/views.py`, `ENDPOINTS.md`
- Datos: `*/models.py`, `DATABASE.md`
- Frontend: `src/routes/AppRoutes.jsx`, `src/pages/*`, `COMPONENTS.md`
