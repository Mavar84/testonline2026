from django.contrib.auth.models import User
from rest_framework import serializers

from .models import PerfilUsuario


class PerfilUsuarioSerializer(serializers.ModelSerializer):
    usuario_id = serializers.IntegerField(source="usuario.id", read_only=True)
    username = serializers.CharField(source="usuario.username", read_only=True)
    email = serializers.EmailField(source="usuario.email", read_only=True)
    tiene_foto_estudiante = serializers.SerializerMethodField()
    foto_estudiante = serializers.CharField(read_only=True)

    class Meta:
        model = PerfilUsuario
        fields = ["id", "usuario_id", "username", "email", "rol", "nombre_completo", "codigo_estudiante", "tiene_foto_estudiante", "foto_estudiante"]

    def get_tiene_foto_estudiante(self, obj):
        return bool(obj.foto_estudiante)


class RegistroEstudianteSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    nombre_completo = serializers.CharField(max_length=255)
    codigo_estudiante = serializers.CharField(max_length=100, required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=4)
    foto_estudiante = serializers.CharField()

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Ese nombre de usuario ya existe.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        nombre_completo = validated_data.pop("nombre_completo", "")
        codigo_estudiante = validated_data.pop("codigo_estudiante", "")
        foto_estudiante = validated_data.pop("foto_estudiante", "")

        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=password,
            first_name=nombre_completo
        )

        user.perfil.rol = PerfilUsuario.ROL_ESTUDIANTE
        user.perfil.nombre_completo = nombre_completo
        user.perfil.codigo_estudiante = codigo_estudiante
        user.perfil.foto_estudiante = foto_estudiante
        user.perfil.save()

        return user

    def to_representation(self, instance):
        return PerfilUsuarioSerializer(instance.perfil).data


class LoginFacialSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    prelogin_token = serializers.CharField()
    foto_estudiante = serializers.CharField()


class PreloginEstudianteSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class ConfiguracionCuentaSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, required=False, allow_blank=False, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, required=False, allow_blank=False, min_length=4, trim_whitespace=False)
    confirm_password = serializers.CharField(write_only=True, required=False, allow_blank=False, min_length=4, trim_whitespace=False)
    foto_estudiante = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        user = self.context["request"].user
        perfil = getattr(user, "perfil", None)
        nueva_clave = attrs.get("new_password")
        confirmar = attrs.get("confirm_password")
        clave_actual = attrs.get("current_password")
        foto_estudiante = attrs.get("foto_estudiante")

        cambios = []

        if nueva_clave or confirmar or clave_actual:
            if not clave_actual:
                raise serializers.ValidationError({"current_password": "Ingresa tu clave actual."})
            if not user.check_password(clave_actual):
                raise serializers.ValidationError({"current_password": "La clave actual no es correcta."})
            if not nueva_clave:
                raise serializers.ValidationError({"new_password": "Ingresa la nueva clave."})
            if nueva_clave != confirmar:
                raise serializers.ValidationError({"confirm_password": "La confirmación no coincide con la nueva clave."})
            cambios.append("password")

        if foto_estudiante is not None:
            if not perfil or perfil.rol != PerfilUsuario.ROL_ESTUDIANTE:
                raise serializers.ValidationError({"foto_estudiante": "Solo los estudiantes pueden actualizar la foto."})
            if not foto_estudiante:
                raise serializers.ValidationError({"foto_estudiante": "Toma una nueva foto antes de guardar."})
            cambios.append("foto")

        if not cambios:
            raise serializers.ValidationError("No hay cambios para guardar.")

        attrs["changes"] = cambios
        return attrs
