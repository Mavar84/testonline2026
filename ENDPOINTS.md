# Endpoints

## Auth base

- `POST /api/token/` — login JWT
- `POST /api/token/refresh/` — refresh JWT

## Core

- `GET|POST /api/core/programas/`
- `GET|POST /api/core/subareas/`
- `GET|POST /api/core/subtemas/`
- `GET|POST /api/core/resultados/`

CRUD completo via DRF router para estructura curricular.

## Items

CRUD:
- `/api/items/documentos/`
- `/api/items/seleccion-unica/`
- `/api/items/seleccion-unica-documentos/`
- `/api/items/respuesta-unica/`
- `/api/items/respuesta-unica-documentos/`
- `/api/items/identificacion/`
- `/api/items/identificacion-componentes/`
- `/api/items/identificacion-documentos/`
- `/api/items/pareo/`
- `/api/items/pareo-detalles/`
- `/api/items/pareo-relaciones/`
- `/api/items/pareo-documentos/`

Extra:
- `POST /api/items/ai/seleccion-unica/`
- `POST /api/items/ai/respuesta-unica/`
- `POST /api/items/ortografia/`

## Pruebas

CRUD:
- `/api/pruebas/pruebas/`
- `/api/pruebas/pruebas-partes/`
- `/api/pruebas/pruebas-items-seleccion/`
- `/api/pruebas/pruebas-items-respuesta/`
- `/api/pruebas/pruebas-items-identificacion/`
- `/api/pruebas/pruebas-items-pareo/`

Acciones relevantes en `PruebaViewSet`:
- `GET /api/pruebas/pruebas/mis_asignadas/`
- `GET /api/pruebas/pruebas/{id}/completa/`
- `POST /api/pruebas/pruebas/{id}/validar_ingreso/`
- `GET|POST /api/pruebas/pruebas/{id}/asignaciones/`

## Respuestas

- `POST /api/respuestas/iniciar-intento/`
- `POST /api/respuestas/responder/`
- `POST /api/respuestas/finalizar-intento/`
- `POST /api/respuestas/entregar-intento/`

Profesor:
- `GET /api/respuestas/profesor/pruebas/{prueba_id}/entregas/`
- `GET /api/respuestas/profesor/pruebas/{prueba_id}/entregas/{intento_id}/`
- `POST /api/respuestas/profesor/pruebas/{prueba_id}/entregas/{intento_id}/autoevaluar/`
- `POST /api/respuestas/profesor/pruebas/{prueba_id}/entregas/{intento_id}/guardar-evaluacion/`
- `POST /api/respuestas/profesor/pruebas/{prueba_id}/entregas/{intento_id}/enviar-calificacion/`

Estudiante:
- `GET /api/respuestas/estudiante/entregas/{intento_id}/`

## Usuarios

- `POST /api/usuarios/registro-estudiante/`
- `GET /api/usuarios/mi-perfil/`
- `POST /api/usuarios/configuracion/`
- `GET /api/usuarios/estudiantes/`
- `POST /api/usuarios/prelogin-estudiante/`
- `POST /api/usuarios/login-facial/`
