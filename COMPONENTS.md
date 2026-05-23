# Components

## Frontend

Paginas:
- `Login`, `StudentLogin`, `RegistroEstudiante`
- `admin/*` para CRUD, pruebas, asignaciones, entregas
- `student/*` para pruebas asignadas, configuracion, revision
- `app/ResolverPrueba` para resolucion del examen

Reutilizables:
- `AdminPageHeader`
- `DocumentoUploader`
- `PhotoCaptureInput`
- `LiveFaceVerifier`
- `ExamEntryVerifier`
- `MathKeyboard`
- `LatexPreview`
- `TextTools`
- `LoadingOverlay`

Servicios:
- `api.js` — cliente Axios con JWT
- `documentos.js` — previews/documentos
- `examCache.js` — IndexedDB para examen offline
- `aiItems.js` — helpers de IA

## Backend

Apps:
- `core`
- `items`
- `pruebas`
- `respuestas`
- `usuarios`

Servicios relevantes:
- `items/blob_storage.py`
- `items/document_service.py`
- `usuarios/face_auth.py`
- `face_service/app/main.py`
