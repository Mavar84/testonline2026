from rest_framework import serializers
from .models import (
    Documento,
    ItemSeleccionUnica,
    ItemSeleccionDocumento,
    ItemRespuestaUnica,
    ItemRespuestaDocumento,
    ItemIdentificacion,
    ItemIdentificacionComponente,
    ItemIdentificacionDocumento,
    ItemPareoEncabezado,
    ItemPareoDetalle,
    ItemPareoRelacion,
    ItemPareoDocumento
)
from .blob_storage import mime_por_tipo
from .blob_storage import hash_from_base64
from .document_service import borrar_blob_si_no_se_usa
from .document_service import obtener_contenido_documento_base64


class DocumentoSerializer(serializers.ModelSerializer):
    contenido_base64 = serializers.CharField(write_only=True, required=False, allow_blank=True)
    contenido = serializers.SerializerMethodField()
    data_url = serializers.SerializerMethodField()

    class Meta:
        model = Documento
        fields = [
            "id",
            "tipo",
            "descripcion",
            "hash",
            "blob_name",
            "mime_type",
            "size_bytes",
            "contenido",
            "contenido_base64",
            "data_url",
        ]
        read_only_fields = ["blob_name", "size_bytes", "contenido", "data_url"]

    def _include_content(self):
        view = self.context.get("view")
        action = getattr(view, "action", None)
        return action in {"retrieve", "create", "update", "partial_update"}

    def _contenido_cache(self, obj):
        cache = getattr(self, "_documento_contenido_cache", None)
        if cache is None:
            cache = {}
            self._documento_contenido_cache = cache

        if obj.pk not in cache:
            cache[obj.pk] = obtener_contenido_documento_base64(obj)
        return cache[obj.pk]

    def get_contenido(self, obj):
        if not self._include_content():
            return None
        return self._contenido_cache(obj)

    def get_data_url(self, obj):
        if not self._include_content():
            return None
        contenido = self._contenido_cache(obj)
        if not contenido:
            return ""
        return f"data:{obj.mime_type or mime_por_tipo(obj.tipo)};base64,{contenido}"

    def _resolver_contenido_entrada(self, validated_data, instance=None):
        contenido_base64 = validated_data.pop("contenido_base64", "") or ""
        contenido = contenido_base64
        if not contenido:
            return None

        from .blob_storage import upload_documento_base64

        tipo = validated_data.get("tipo", getattr(instance, "tipo", None))
        mime_type = validated_data.get("mime_type") or getattr(instance, "mime_type", None) or mime_por_tipo(tipo)
        if not validated_data.get("hash"):
            validated_data["hash"] = hash_from_base64(contenido)
        info_blob = upload_documento_base64(
            contenido,
            tipo,
            mime_type=mime_type,
            documento_hash=validated_data.get("hash") or getattr(instance, "hash", None),
        )
        validated_data["blob_name"] = info_blob["blob_name"]
        validated_data["mime_type"] = info_blob["mime_type"]
        validated_data["size_bytes"] = info_blob["size_bytes"]
        return info_blob["blob_name"]

    def create(self, validated_data):
        self._resolver_contenido_entrada(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        old_blob_name = instance.blob_name
        self._resolver_contenido_entrada(validated_data, instance=instance)
        instance = super().update(instance, validated_data)
        if old_blob_name and old_blob_name != instance.blob_name:
            borrar_blob_si_no_se_usa(old_blob_name, Documento, documento_id_excluir=instance.id)
        return instance


class ItemSeleccionUnicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemSeleccionUnica
        fields = '__all__'


class ItemSeleccionDocumentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemSeleccionDocumento
        fields = '__all__'


class ItemRespuestaUnicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemRespuestaUnica
        fields = '__all__'


class ItemRespuestaDocumentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemRespuestaDocumento
        fields = '__all__'


class ItemIdentificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemIdentificacion
        fields = '__all__'


class ItemIdentificacionComponenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemIdentificacionComponente
        fields = '__all__'


class ItemIdentificacionDocumentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemIdentificacionDocumento
        fields = '__all__'


class ItemPareoEncabezadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemPareoEncabezado
        fields = '__all__'


class ItemPareoDetalleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemPareoDetalle
        fields = '__all__'


class ItemPareoRelacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemPareoRelacion
        fields = '__all__'


class ItemPareoDocumentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemPareoDocumento
        fields = '__all__'
