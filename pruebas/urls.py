from rest_framework.routers import DefaultRouter
from .views import (
    PruebaViewSet,
    PruebaParteViewSet,
    PruebaItemSeleccionViewSet,
    PruebaItemRespuestaViewSet,
    PruebaItemIdentificacionViewSet,
    PruebaItemPareoViewSet
)

router = DefaultRouter()
router.register(r'pruebas', PruebaViewSet)
router.register(r'pruebas-partes', PruebaParteViewSet)
router.register(r'pruebas-items-seleccion', PruebaItemSeleccionViewSet)
router.register(r'pruebas-items-respuesta', PruebaItemRespuestaViewSet)
router.register(r'pruebas-items-identificacion', PruebaItemIdentificacionViewSet)
router.register(r'pruebas-items-pareo', PruebaItemPareoViewSet)

urlpatterns = router.urls
