# TestOnline 2026

Sistema de evaluacion en linea para crear, asignar, resolver y calificar pruebas.

## Stack

- Django + DRF + JWT
- React + Vite
- PostgreSQL
- Azurite para documentos
- FastAPI + InsightFace para biometria
- Docker Compose

## Regla base

Todo corre en Docker local.  
No ejecutar servicios fuera de contenedores.

## Inicio

```bash
docker compose up --build
```

Requiere `.env` basado en `.env.example`.

## URLs

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000/api`

## Contexto IA

Leer primero:
1. `AI_CONTEXT.md`
2. `RULES.md`
3. `ARCHITECTURE.md`
