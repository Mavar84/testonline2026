from django.db import models

# Create your models here.

from django.db import models
from django.contrib.auth.models import User


class IntentoPrueba(models.Model):
    
    estudiante = models.ForeignKey(User, on_delete=models.CASCADE)  # luego lo podemos convertir a FK a Usuario
    prueba = models.ForeignKey('pruebas.Prueba', on_delete=models.CASCADE)

    fecha_inicio = models.DateTimeField(auto_now_add=True)
    fecha_fin = models.DateTimeField(null=True, blank=True)

    puntaje_obtenido = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    porcentaje_obtenido = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    nota_obtenida = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    hash_entrega = models.CharField(max_length=64, null=True, blank=True)
    correo_confirmacion_enviado = models.BooleanField(default=False)
    fecha_confirmacion_enviada = models.DateTimeField(null=True, blank=True)
    correo_calificacion_enviado = models.BooleanField(default=False)
    fecha_calificacion_enviada = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Intento {self.id} - Prueba {self.prueba.id}"
class RespuestaSeleccion(models.Model):
    intento = models.ForeignKey(
        IntentoPrueba,
        on_delete=models.CASCADE,
        related_name='respuestas_seleccion'
    )

    item = models.ForeignKey(
        'items.ItemSeleccionUnica',
        on_delete=models.CASCADE
    )

    respuesta = models.IntegerField()

    puntaje_ganado = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    puntaje_posible = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    comentario_profesor = models.TextField(null=True, blank=True)
class RespuestaRespuestaUnica(models.Model):
    intento = models.ForeignKey(
        IntentoPrueba,
        on_delete=models.CASCADE,
        related_name='respuestas_abiertas'
    )

    item = models.ForeignKey(
        'items.ItemRespuestaUnica',
        on_delete=models.CASCADE
    )

    respuesta = models.JSONField()

    puntaje_ganado = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    puntaje_posible = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    comentario_profesor = models.TextField(null=True, blank=True)
class RespuestaIdentificacion(models.Model):
    intento = models.ForeignKey(
        IntentoPrueba,
        on_delete=models.CASCADE,
        related_name='respuestas_identificacion'
    )

    item = models.ForeignKey(
        'items.ItemIdentificacion',
        on_delete=models.CASCADE
    )

    respuesta_texto = models.TextField()

    puntaje_ganado = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    puntaje_posible = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    comentario_profesor = models.TextField(null=True, blank=True)
class RespuestaPareo(models.Model):
    intento = models.ForeignKey(
        IntentoPrueba,
        on_delete=models.CASCADE,
        related_name='respuestas_pareo'
    )

    item = models.ForeignKey(
        'items.ItemPareoEncabezado',
        on_delete=models.CASCADE
    )

    respuesta_texto = models.TextField()  # JSON con relaciones

    puntaje_ganado = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    puntaje_posible = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    comentario_profesor = models.TextField(null=True, blank=True)
