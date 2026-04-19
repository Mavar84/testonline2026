from rest_framework import serializers
from .models import (
    Prueba,
    PruebaParte,
    PruebaItemSeleccion,
    PruebaItemRespuesta,
    PruebaItemIdentificacion,
    PruebaItemPareo,
    PruebaAsignacion
)


class PruebaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)

    class Meta:
        model = Prueba
        fields = '__all__'
        read_only_fields = ['usuario', 'usuario_nombre', 'fecha_creacion']


class PruebaParteSerializer(serializers.ModelSerializer):
    class Meta:
        model = PruebaParte
        fields = '__all__'


class PruebaItemSeleccionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PruebaItemSeleccion
        fields = '__all__'


class PruebaItemRespuestaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PruebaItemRespuesta
        fields = '__all__'


class PruebaItemIdentificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PruebaItemIdentificacion
        fields = '__all__'


class PruebaItemPareoSerializer(serializers.ModelSerializer):
    class Meta:
        model = PruebaItemPareo
        fields = '__all__'


class PruebaAsignacionSerializer(serializers.ModelSerializer):
    estudiante_nombre = serializers.SerializerMethodField()
    estudiante_username = serializers.CharField(source='estudiante.username', read_only=True)

    class Meta:
        model = PruebaAsignacion
        fields = '__all__'

    def get_estudiante_nombre(self, obj):
        if hasattr(obj.estudiante, "perfil") and obj.estudiante.perfil.nombre_completo:
            return obj.estudiante.perfil.nombre_completo
        return obj.estudiante.get_full_name() or obj.estudiante.username
