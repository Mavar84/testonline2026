from django.db import models

# Create your models here.

from django.contrib.auth.models import User


class Prueba(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_aplicacion = models.DateTimeField(null=True, blank=True)

    centro_educativo = models.CharField(max_length=300, null=True, blank=True)
    asignatura = models.CharField(max_length=300, null=True, blank=True)
    periodo = models.CharField(max_length=100, null=True, blank=True)
    nivel = models.CharField(max_length=100, null=True, blank=True)
    duracion_minutos = models.IntegerField(null=True, blank=True, default=60)

    puntos_totales = models.IntegerField(null=True, blank=True)
    porcentaje_total = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return f"Prueba {self.id} - {self.asignatura}"


class PruebaParte(models.Model):
    prueba = models.ForeignKey(Prueba, on_delete=models.CASCADE, related_name='partes')
    nombre = models.CharField(max_length=255)
    tipo = models.CharField(max_length=30)
    orden = models.IntegerField(default=1)
    cantidad_requerida = models.IntegerField(default=1)
    puntaje_objetivo = models.DecimalField(max_digits=6, decimal_places=2, default=1)
    modo_respuesta = models.CharField(max_length=30, default='uno')

    class Meta:
        ordering = ['orden', 'id']

    def __str__(self):
        return f"Parte {self.orden} - {self.nombre}"


class PruebaItemSeleccion(models.Model):
    prueba = models.ForeignKey(Prueba, on_delete=models.CASCADE, related_name='items_seleccion')
    parte = models.ForeignKey('PruebaParte', on_delete=models.CASCADE, related_name='items_seleccion', null=True, blank=True)
    item = models.ForeignKey('items.ItemSeleccionUnica', on_delete=models.CASCADE)

    orden = models.IntegerField()
    puntaje = models.DecimalField(max_digits=5, decimal_places=2, default=1)
class PruebaItemRespuesta(models.Model):
    prueba = models.ForeignKey(Prueba, on_delete=models.CASCADE, related_name='items_respuesta')
    parte = models.ForeignKey('PruebaParte', on_delete=models.CASCADE, related_name='items_respuesta', null=True, blank=True)
    item = models.ForeignKey('items.ItemRespuestaUnica', on_delete=models.CASCADE)

    orden = models.IntegerField()
    puntaje = models.DecimalField(max_digits=5, decimal_places=2, default=1)
class PruebaItemIdentificacion(models.Model):
    prueba = models.ForeignKey(Prueba, on_delete=models.CASCADE, related_name='items_identificacion')
    parte = models.ForeignKey('PruebaParte', on_delete=models.CASCADE, related_name='items_identificacion', null=True, blank=True)
    item = models.ForeignKey('items.ItemIdentificacion', on_delete=models.CASCADE)

    orden = models.IntegerField()
    puntaje = models.DecimalField(max_digits=5, decimal_places=2, default=1)
class PruebaItemPareo(models.Model):
    prueba = models.ForeignKey(Prueba, on_delete=models.CASCADE, related_name='items_pareo')
    parte = models.ForeignKey('PruebaParte', on_delete=models.CASCADE, related_name='items_pareo', null=True, blank=True)
    item = models.ForeignKey('items.ItemPareoEncabezado', on_delete=models.CASCADE)

    orden = models.IntegerField()
    puntaje = models.DecimalField(max_digits=5, decimal_places=2, default=1)


class PruebaAsignacion(models.Model):
    prueba = models.ForeignKey(Prueba, on_delete=models.CASCADE, related_name='asignaciones')
    estudiante = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pruebas_asignadas')
    fecha_asignacion = models.DateTimeField(auto_now_add=True)
    activo = models.BooleanField(default=True)

    class Meta:
        unique_together = ('prueba', 'estudiante')

    def __str__(self):
        return f"Prueba {self.prueba_id} -> {self.estudiante.username}"
