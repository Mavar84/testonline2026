from django.urls import path

from .views import (
    RegistroEstudianteView,
    actualizar_configuracion,
    listar_estudiantes,
    login_facial_estudiante,
    mi_perfil,
    prelogin_estudiante,
)


urlpatterns = [
    path("registro-estudiante/", RegistroEstudianteView.as_view()),
    path("mi-perfil/", mi_perfil),
    path("configuracion/", actualizar_configuracion),
    path("estudiantes/", listar_estudiantes),
    path("prelogin-estudiante/", prelogin_estudiante),
    path("login-facial/", login_facial_estudiante),
]
