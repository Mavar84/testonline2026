# Architecture

## Regla obligatoria

Toda la arquitectura depende de Docker Compose.  
No mover servicios al host.  
Cualquier servicio nuevo debe entrar en `docker-compose.yml`.

## Contenedores

- `frontend`: React + Nginx
- `backend`: Django + Gunicorn
- `postgres`: datos
- `blob`: Azurite para documentos
- `faceauth`: validacion facial

## Relacion

- `frontend` -> `backend`
- `backend` -> `postgres`
- `backend` -> `blob`
- `backend` -> `faceauth`

## Modulos

- `core`: estructura curricular
- `items`: banco de items y documentos
- `pruebas`: pruebas, partes, asignaciones
- `respuestas`: intentos, envio, revision
- `usuarios`: perfil, roles, biometria

## Flujo

Profesor crea prueba -> asigna estudiantes -> estudiante valida acceso -> resuelve -> envia -> profesor revisa y califica.
