from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import (
    Prueba,
    PruebaItemSeleccion,
    PruebaItemRespuesta,
    PruebaItemIdentificacion,
    PruebaItemPareo
)

admin.site.register(Prueba)
admin.site.register(PruebaItemSeleccion)
admin.site.register(PruebaItemRespuesta)
admin.site.register(PruebaItemIdentificacion)
admin.site.register(PruebaItemPareo)