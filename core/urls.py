from rest_framework.routers import DefaultRouter
from .views import (
    ProgramaEstudioViewSet,
    SubareaViewSet,
    SubtemaViewSet,
    ResultadoAprendizajeViewSet
)

router = DefaultRouter()
router.register(r'programas', ProgramaEstudioViewSet)
router.register(r'subareas', SubareaViewSet)
router.register(r'subtemas', SubtemaViewSet)
router.register(r'resultados', ResultadoAprendizajeViewSet)

urlpatterns = router.urls