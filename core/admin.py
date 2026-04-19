from django.contrib import admin

# Register your models here.
from django.contrib import admin
from .models import ProgramaEstudio, Subarea, Subtema, ResultadoAprendizaje

admin.site.register(ProgramaEstudio)
admin.site.register(Subarea)
admin.site.register(Subtema)
admin.site.register(ResultadoAprendizaje)