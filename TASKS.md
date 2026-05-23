# Tasks

## Deuda tecnica visible

- Existen endpoints viejos de respuestas (`responder`, `finalizar-intento`) junto al flujo final `entregar-intento`; conviene consolidarlos.
- Hay configuracion sensible local aun referenciada por variables que dependen del `.env`; revisar endurecimiento para entornos compartidos.
- La validacion facial fue movida a servicio aparte y requiere calibracion real de umbrales con mas pruebas.

## Partes a vigilar

- Resolver examen offline + envio final: flujo delicado por hash, cache y tiempo.
- CRUD de items con documentos: depende de blob y de relaciones por tipo.
- Calificacion de respuesta unica: la similitud es sugerencia, no criterio definitivo.

## Mejoras posibles detectadas

- Unificar reporte de estado entre profesor y estudiante.
- Agregar pruebas automatizadas reales; hoy la carpeta `tests.py` existe pero no refleja cobertura amplia.
