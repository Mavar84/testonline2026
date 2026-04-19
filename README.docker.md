# Docker local

Este proyecto queda preparado para levantarse localmente con cinco contenedores:

- `postgres`: base de datos PostgreSQL
- `backend`: Django + Gunicorn
- `frontend`: React/Vite compilado y servido con Nginx
- `blob`: Azurite como emulador local de Azure Blob Storage
- `faceauth`: servicio facial separado para validación biométrica

## Levantar el stack

Desde la raíz del proyecto:

```bash
docker compose up --build
```

Antes de eso, asegúrate de que tu archivo `.env` local tenga estas variables para Azurite:

```bash
AZURITE_ACCOUNTS=devstoreaccount1=<tu_clave_local>
AZURE_BLOB_ACCOUNT_KEY=<tu_clave_local>
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=<tu_clave_local>;BlobEndpoint=http://blob:10000/devstoreaccount1;
```

Servicios expuestos:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:8000/api](http://localhost:8000/api)
- PostgreSQL: `localhost:5433`
- Blob local (Azurite): [http://localhost:10000](http://localhost:10000)
- Face service: [http://localhost:8010/health](http://localhost:8010/health)

## Apagar

```bash
docker compose down
```

Si también quieres borrar los volúmenes locales:

```bash
docker compose down -v
```

## Notas importantes

1. El contenedor `blob` corre Azurite y ya se usa para almacenar los documentos del sistema.
2. El backend ejecuta migraciones automáticamente al iniciar.
3. Si necesitas mover documentos heredados desde la BD hacia blob, usa `docker compose exec -T backend python manage.py migrate_documents_to_blob`.
4. El frontend toma la URL de la API desde `VITE_API_BASE_URL` en el build del contenedor.
5. El servicio `faceauth` descarga su modelo facial en el primer arranque; por eso la primera subida puede tardar más que las siguientes.
