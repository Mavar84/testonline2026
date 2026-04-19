from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.core import signing
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .face_auth import comparar_fotos
from .models import PerfilUsuario
from .serializers import (
    ConfiguracionCuentaSerializer,
    LoginFacialSerializer,
    PerfilUsuarioSerializer,
    PreloginEstudianteSerializer,
    RegistroEstudianteSerializer,
)


PRELOGIN_SALT = "student-face-login"
PRELOGIN_MAX_AGE_SECONDS = 300


class RegistroEstudianteView(generics.CreateAPIView):
    serializer_class = RegistroEstudianteSerializer
    permission_classes = [AllowAny]


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def mi_perfil(request):
    perfil = getattr(request.user, "perfil", None)
    if not perfil:
        return Response({"detail": "No se encontró el perfil del usuario."}, status=status.HTTP_404_NOT_FOUND)
    return Response(PerfilUsuarioSerializer(perfil).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def listar_estudiantes(request):
    estudiantes = PerfilUsuario.objects.filter(rol=PerfilUsuario.ROL_ESTUDIANTE).select_related("usuario").order_by("nombre_completo", "usuario__username")
    serializer = PerfilUsuarioSerializer(estudiantes, many=True)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([AllowAny])
def prelogin_estudiante(request):
    serializer = PreloginEstudianteSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    username = serializer.validated_data["username"]
    password = serializer.validated_data["password"]

    user = authenticate(request, username=username, password=password)
    if not user:
        return Response({"detail": "Usuario o clave incorrectos."}, status=status.HTTP_401_UNAUTHORIZED)

    perfil = getattr(user, "perfil", None)
    if not perfil or perfil.rol != PerfilUsuario.ROL_ESTUDIANTE:
        return Response({"detail": "Ese usuario no corresponde a un estudiante."}, status=status.HTTP_403_FORBIDDEN)

    if not perfil.foto_estudiante:
        return Response({"detail": "Este estudiante no tiene una foto registrada."}, status=status.HTTP_400_BAD_REQUEST)

    prelogin_token = signing.dumps(
        {"user_id": user.id, "username": user.username, "purpose": PRELOGIN_SALT},
        salt=PRELOGIN_SALT
    )
    return Response(
        {
            "prelogin_token": prelogin_token,
            "perfil": PerfilUsuarioSerializer(perfil).data,
        }
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def login_facial_estudiante(request):
    serializer = LoginFacialSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    username = serializer.validated_data["username"]
    prelogin_token = serializer.validated_data["prelogin_token"]
    foto_estudiante = serializer.validated_data["foto_estudiante"]

    try:
        datos_prelogin = signing.loads(
            prelogin_token,
            salt=PRELOGIN_SALT,
            max_age=PRELOGIN_MAX_AGE_SECONDS
        )
    except signing.SignatureExpired:
        return Response({"detail": "La validacion previa expiró. Ingresa usuario y clave otra vez."}, status=status.HTTP_401_UNAUTHORIZED)
    except signing.BadSignature:
        return Response({"detail": "La validacion previa no es valida."}, status=status.HTTP_401_UNAUTHORIZED)

    if datos_prelogin.get("purpose") != PRELOGIN_SALT or datos_prelogin.get("username") != username:
        return Response({"detail": "La validacion previa no corresponde a este usuario."}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        user = User.objects.select_related("perfil").get(username=username)
    except User.DoesNotExist:
        return Response({"detail": "No existe un estudiante con ese usuario."}, status=status.HTTP_404_NOT_FOUND)

    perfil = getattr(user, "perfil", None)
    if not perfil or perfil.rol != PerfilUsuario.ROL_ESTUDIANTE:
        return Response({"detail": "Ese usuario no corresponde a un estudiante."}, status=status.HTTP_403_FORBIDDEN)

    if not perfil.foto_estudiante:
        return Response({"detail": "Este estudiante no tiene una foto registrada."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        resultado = comparar_fotos(perfil.foto_estudiante, foto_estudiante)
    except ValueError as error:
        return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception:
        return Response({"detail": "No se pudo procesar la validacion facial."}, status=status.HTTP_400_BAD_REQUEST)

    if not resultado["coincide"]:
        return Response(
            {
                "detail": "La foto no coincide con la registrada.",
                "similitud": resultado["similitud"],
                "similitud_coseno": resultado["similitud_coseno"],
                "similitud_histograma": resultado["similitud_histograma"],
                "similitud_lbph": resultado["similitud_lbph"],
                "similitud_orb": resultado["similitud_orb"],
                "orientacion": resultado["orientacion"],
            },
            status=status.HTTP_401_UNAUTHORIZED
        )

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "similitud": resultado["similitud"],
            "similitud_coseno": resultado["similitud_coseno"],
            "similitud_histograma": resultado["similitud_histograma"],
            "similitud_lbph": resultado["similitud_lbph"],
            "similitud_orb": resultado["similitud_orb"],
            "orientacion": resultado["orientacion"],
            "perfil": PerfilUsuarioSerializer(perfil).data,
        }
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def actualizar_configuracion(request):
    serializer = ConfiguracionCuentaSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)

    user = request.user
    perfil = getattr(user, "perfil", None)
    changes = serializer.validated_data["changes"]

    if "password" in changes:
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])

    if "foto" in changes and perfil:
        perfil.foto_estudiante = serializer.validated_data["foto_estudiante"]
        perfil.save(update_fields=["foto_estudiante"])

    return Response(
        {
            "ok": True,
            "requires_relogin": True,
            "perfil": PerfilUsuarioSerializer(perfil).data if perfil else None,
        }
    )
