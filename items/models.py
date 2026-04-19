from django.db import models



class ItemSeleccionUnica(models.Model):
    enunciado = models.TextField()
    usa_latex = models.BooleanField(default=False)

    opcion1 = models.TextField()
    opcion2 = models.TextField()
    opcion3 = models.TextField()
    opcion4 = models.TextField()
    opcion5 = models.TextField(null=True, blank=True)
    opcion6 = models.TextField(null=True, blank=True)
    opcion7 = models.TextField(null=True, blank=True)

    numero_opcion_correcta = models.IntegerField()

    resultado = models.ForeignKey(
        'core.ResultadoAprendizaje',
        on_delete=models.SET_NULL,
        null=True,
        related_name='items_seleccion'
    )

    categoria = models.CharField(max_length=100, null=True, blank=True)
    comentarios = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"Item {self.id} - {self.enunciado[:50]}"
    
class Documento(models.Model):
        tipo = models.IntegerField(null=True, blank=True)
        descripcion = models.TextField(null=True, blank=True)
        hash = models.CharField(max_length=64, null=True, blank=True)
        blob_name = models.CharField(max_length=255, null=True, blank=True)
        mime_type = models.CharField(max_length=120, null=True, blank=True)
        size_bytes = models.PositiveIntegerField(null=True, blank=True)

        def __str__(self):
            return f"Documento {self.id}"
class ItemSeleccionDocumento(models.Model):
        item = models.ForeignKey(
            ItemSeleccionUnica,
            on_delete=models.CASCADE,
            related_name='documentos'
        )
        documento = models.ForeignKey(
            Documento,
            on_delete=models.CASCADE
        )
        orden = models.IntegerField(null=True, blank=True)
        contexto = models.TextField(null=True, blank=True)

        class Meta:
            unique_together = ('item', 'documento')
class ItemRespuestaUnica(models.Model):
    enunciado = models.TextField()
    usa_latex = models.BooleanField(default=False)
    respuesta_ejemplo = models.TextField(null=True, blank=True)

    resultado = models.ForeignKey(
        'core.ResultadoAprendizaje',
        on_delete=models.SET_NULL,
        null=True,
        related_name='items_respuesta'
    )

    categoria = models.CharField(max_length=100, null=True, blank=True)
    comentarios = models.TextField(null=True, blank=True)

    def __str__(self):
        return f"Item RU {self.id} - {self.enunciado[:50]}"
class ItemRespuestaDocumento(models.Model):
    item = models.ForeignKey(
        ItemRespuestaUnica,
        on_delete=models.CASCADE,
        related_name='documentos'
    )
    documento = models.ForeignKey(
        Documento,
        on_delete=models.CASCADE
    )
    orden = models.IntegerField(null=True, blank=True)
    contexto = models.TextField(null=True, blank=True)

    class Meta:
        unique_together = ('item', 'documento')
class ItemIdentificacion(models.Model):
    enunciado = models.TextField()
    descripcion = models.TextField(null=True, blank=True)

    imagen = models.TextField(null=True, blank=True)  
    # luego esto lo podemos cambiar a URL o storage en Supabase

    resultado = models.ForeignKey(
        'core.ResultadoAprendizaje',
        on_delete=models.SET_NULL,
        null=True,
        related_name='items_identificacion'
    )

    def __str__(self):
        return f"Item ID {self.id} - {self.enunciado[:50]}"
class ItemIdentificacionComponente(models.Model):
    item = models.ForeignKey(
        ItemIdentificacion,
        on_delete=models.CASCADE,
        related_name='componentes'
    )

    coordenada_x = models.CharField(max_length=30)
    coordenada_y = models.CharField(max_length=30)

    respuesta_correcta = models.TextField()

    def __str__(self):
        return f"Comp {self.id} - Item {self.item.id}"
class ItemIdentificacionDocumento(models.Model):
    item = models.ForeignKey(
        ItemIdentificacion,
        on_delete=models.CASCADE,
        related_name='documentos'
    )
    documento = models.ForeignKey(
        Documento,
        on_delete=models.CASCADE
    )

    orden = models.IntegerField(null=True, blank=True)
    contexto = models.TextField(null=True, blank=True)

    class Meta:
        unique_together = ('item', 'documento')
class ItemPareoEncabezado(models.Model):
    enunciado = models.TextField()

    resultado = models.ForeignKey(
        'core.ResultadoAprendizaje',
        on_delete=models.SET_NULL,
        null=True,
        related_name='items_pareo'
    )

    def __str__(self):
        return f"Pareo {self.id} - {self.enunciado[:50]}"
class ItemPareoDetalle(models.Model):
    texto = models.TextField()

    encabezado = models.ForeignKey(
        ItemPareoEncabezado,
        on_delete=models.CASCADE,
        related_name='detalles'
    )

    def __str__(self):
        return f"Detalle {self.id} - {self.texto[:40]}"
class ItemPareoRelacion(models.Model):
    item_izquierda = models.ForeignKey(
        ItemPareoDetalle,
        on_delete=models.CASCADE,
        related_name='relaciones_izquierda'
    )

    item_derecha = models.ForeignKey(
        ItemPareoDetalle,
        on_delete=models.CASCADE,
        related_name='relaciones_derecha'
    )

    class Meta:
        unique_together = ('item_izquierda', 'item_derecha')

    def __str__(self):
        return f"{self.item_izquierda.id} -> {self.item_derecha.id}"
class ItemPareoDocumento(models.Model):
    item = models.ForeignKey(
        ItemPareoEncabezado,
        on_delete=models.CASCADE,
        related_name='documentos'
    )
    documento = models.ForeignKey(
        Documento,
        on_delete=models.CASCADE
    )

    orden = models.IntegerField(null=True, blank=True)
    contexto = models.TextField(null=True, blank=True)

    class Meta:
        unique_together = ('item', 'documento')
