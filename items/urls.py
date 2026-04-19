from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    DocumentoViewSet,
    ItemSeleccionUnicaViewSet,
    ItemSeleccionDocumentoViewSet,
    ItemRespuestaUnicaViewSet,
    ItemRespuestaDocumentoViewSet,
    ItemIdentificacionViewSet,
    ItemIdentificacionComponenteViewSet,
    ItemIdentificacionDocumentoViewSet,
    ItemPareoEncabezadoViewSet,
    ItemPareoDetalleViewSet,
    ItemPareoRelacionViewSet,
    ItemPareoDocumentoViewSet,
    generar_opciones_seleccion_unica,
    generar_respuestas_unicas,
    revisar_ortografia
)

router = DefaultRouter()
router.register(r'documentos', DocumentoViewSet)
router.register(r'seleccion-unica', ItemSeleccionUnicaViewSet)
router.register(r'seleccion-unica-documentos', ItemSeleccionDocumentoViewSet)
router.register(r'respuesta-unica', ItemRespuestaUnicaViewSet)
router.register(r'respuesta-unica-documentos', ItemRespuestaDocumentoViewSet)
router.register(r'identificacion', ItemIdentificacionViewSet)
router.register(r'identificacion-componentes', ItemIdentificacionComponenteViewSet)
router.register(r'identificacion-documentos', ItemIdentificacionDocumentoViewSet)
router.register(r'pareo', ItemPareoEncabezadoViewSet)
router.register(r'pareo-detalles', ItemPareoDetalleViewSet)
router.register(r'pareo-relaciones', ItemPareoRelacionViewSet)
router.register(r'pareo-documentos', ItemPareoDocumentoViewSet)

urlpatterns = [
    path('ai/seleccion-unica/', generar_opciones_seleccion_unica),
    path('ai/respuesta-unica/', generar_respuestas_unicas),
    path('ortografia/', revisar_ortografia),
]

urlpatterns += router.urls
