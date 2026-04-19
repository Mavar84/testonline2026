from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import (
    IntentoPrueba,
    RespuestaSeleccion,
    RespuestaRespuestaUnica,
    RespuestaIdentificacion,
    RespuestaPareo
)

admin.site.register(IntentoPrueba)
admin.site.register(RespuestaSeleccion)
admin.site.register(RespuestaRespuestaUnica)
admin.site.register(RespuestaIdentificacion)
admin.site.register(RespuestaPareo)