from django.urls import path
from .views import (
    autoevaluar_entrega_profesor,
    detalle_entrega_profesor,
    detalle_entrega_estudiante,
    entregar_intento,
    enviar_calificacion_profesor,
    finalizar_intento,
    guardar_evaluacion_profesor,
    iniciar_intento,
    listar_entregas_profesor,
    responder,
)

urlpatterns = [
    path('iniciar-intento/', iniciar_intento),
    path('responder/', responder),
    path('finalizar-intento/', finalizar_intento),
    path('entregar-intento/', entregar_intento),
    path('profesor/pruebas/<int:prueba_id>/entregas/', listar_entregas_profesor),
    path('profesor/pruebas/<int:prueba_id>/entregas/<int:intento_id>/', detalle_entrega_profesor),
    path('profesor/pruebas/<int:prueba_id>/entregas/<int:intento_id>/autoevaluar/', autoevaluar_entrega_profesor),
    path('profesor/pruebas/<int:prueba_id>/entregas/<int:intento_id>/guardar-evaluacion/', guardar_evaluacion_profesor),
    path('profesor/pruebas/<int:prueba_id>/entregas/<int:intento_id>/enviar-calificacion/', enviar_calificacion_profesor),
    path('estudiante/entregas/<int:intento_id>/', detalle_entrega_estudiante),
]
