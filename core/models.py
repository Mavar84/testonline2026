from django.db import models




class ProgramaEstudio(models.Model):
    nombre = models.CharField(max_length=300)
    descripcion = models.TextField(null=True, blank=True)

    def __str__(self):
        return self.nombre


class Subarea(models.Model):
    nombre = models.CharField(max_length=300)
    descripcion = models.TextField(null=True, blank=True)
    programa = models.ForeignKey(
        ProgramaEstudio,
        on_delete=models.CASCADE,
        related_name='subareas'
    )

    def __str__(self):
        return self.nombre


class Subtema(models.Model):
    nombre = models.CharField(max_length=300)
    descripcion = models.TextField(null=True, blank=True)
    subarea = models.ForeignKey(
        Subarea,
        on_delete=models.CASCADE,
        related_name='subtemas'
    )

    def __str__(self):
        return self.nombre


class ResultadoAprendizaje(models.Model):
    texto = models.TextField()
    subtema = models.ForeignKey(
        Subtema,
        on_delete=models.CASCADE,
        related_name='resultados'
    )

    def __str__(self):
        return self.texto[:50]