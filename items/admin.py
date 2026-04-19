from django.contrib import admin


from .models import ItemSeleccionUnica, Documento, ItemSeleccionDocumento

admin.site.register(ItemSeleccionUnica)
admin.site.register(Documento)
admin.site.register(ItemSeleccionDocumento)
from .models import ItemRespuestaUnica, ItemRespuestaDocumento

admin.site.register(ItemRespuestaUnica)
admin.site.register(ItemRespuestaDocumento)
from .models import ItemIdentificacion, ItemIdentificacionComponente, ItemIdentificacionDocumento

admin.site.register(ItemIdentificacion)
admin.site.register(ItemIdentificacionComponente)
admin.site.register(ItemIdentificacionDocumento)
from .models import (
    ItemPareoEncabezado,
    ItemPareoDetalle,
    ItemPareoRelacion,
    ItemPareoDocumento
)

admin.site.register(ItemPareoEncabezado)
admin.site.register(ItemPareoDetalle)
admin.site.register(ItemPareoRelacion)
admin.site.register(ItemPareoDocumento)