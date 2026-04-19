import json
import ssl
from urllib.error import HTTPError
from urllib.error import URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

from django.shortcuts import render

# Create your views here.
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
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
from .serializers import (
    DocumentoSerializer,
    ItemSeleccionUnicaSerializer,
    ItemSeleccionDocumentoSerializer,
    ItemRespuestaUnicaSerializer,
    ItemRespuestaDocumentoSerializer,
    ItemIdentificacionSerializer,
    ItemIdentificacionComponenteSerializer,
    ItemIdentificacionDocumentoSerializer,
    ItemPareoEncabezadoSerializer,
    ItemPareoDetalleSerializer,
    ItemPareoRelacionSerializer,
    ItemPareoDocumentoSerializer
)
from .document_service import borrar_blob_si_no_se_usa


class DocumentoViewSet(viewsets.ModelViewSet):
    queryset = Documento.objects.all().order_by('id')
    serializer_class = DocumentoSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        doc_hash = (request.data.get("hash") or "").strip()

        if doc_hash:
            existente = Documento.objects.filter(hash=doc_hash).first()
            if existente:
                serializer = self.get_serializer(existente)
                return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)

    def perform_destroy(self, instance):
        blob_name = instance.blob_name
        instance.delete()
        borrar_blob_si_no_se_usa(blob_name, Documento)


class ItemSeleccionUnicaViewSet(viewsets.ModelViewSet):
    queryset = ItemSeleccionUnica.objects.all().order_by('id')
    serializer_class = ItemSeleccionUnicaSerializer
    permission_classes = [IsAuthenticated]


class ItemSeleccionDocumentoViewSet(viewsets.ModelViewSet):
    queryset = ItemSeleccionDocumento.objects.all().order_by('id')
    serializer_class = ItemSeleccionDocumentoSerializer
    permission_classes = [IsAuthenticated]


class ItemRespuestaUnicaViewSet(viewsets.ModelViewSet):
    queryset = ItemRespuestaUnica.objects.all().order_by('id')
    serializer_class = ItemRespuestaUnicaSerializer
    permission_classes = [IsAuthenticated]


class ItemRespuestaDocumentoViewSet(viewsets.ModelViewSet):
    queryset = ItemRespuestaDocumento.objects.all().order_by('id')
    serializer_class = ItemRespuestaDocumentoSerializer
    permission_classes = [IsAuthenticated]


class ItemIdentificacionViewSet(viewsets.ModelViewSet):
    queryset = ItemIdentificacion.objects.all().order_by('id')
    serializer_class = ItemIdentificacionSerializer
    permission_classes = [IsAuthenticated]


class ItemIdentificacionComponenteViewSet(viewsets.ModelViewSet):
    queryset = ItemIdentificacionComponente.objects.all().order_by('id')
    serializer_class = ItemIdentificacionComponenteSerializer
    permission_classes = [IsAuthenticated]


class ItemIdentificacionDocumentoViewSet(viewsets.ModelViewSet):
    queryset = ItemIdentificacionDocumento.objects.all().order_by('id')
    serializer_class = ItemIdentificacionDocumentoSerializer
    permission_classes = [IsAuthenticated]


class ItemPareoEncabezadoViewSet(viewsets.ModelViewSet):
    queryset = ItemPareoEncabezado.objects.all().order_by('id')
    serializer_class = ItemPareoEncabezadoSerializer
    permission_classes = [IsAuthenticated]


class ItemPareoDetalleViewSet(viewsets.ModelViewSet):
    queryset = ItemPareoDetalle.objects.all().order_by('id')
    serializer_class = ItemPareoDetalleSerializer
    permission_classes = [IsAuthenticated]


class ItemPareoRelacionViewSet(viewsets.ModelViewSet):
    queryset = ItemPareoRelacion.objects.all().order_by('id')
    serializer_class = ItemPareoRelacionSerializer
    permission_classes = [IsAuthenticated]


class ItemPareoDocumentoViewSet(viewsets.ModelViewSet):
    queryset = ItemPareoDocumento.objects.all().order_by('id')
    serializer_class = ItemPareoDocumentoSerializer
    permission_classes = [IsAuthenticated]


def extraer_json_ia(texto):
    inicio_objeto = texto.find("{")
    fin_objeto = texto.rfind("}")

    if inicio_objeto >= 0 and fin_objeto > inicio_objeto:
        return json.loads(texto[inicio_objeto:fin_objeto + 1])

    inicio_lista = texto.find("[")
    fin_lista = texto.rfind("]")

    if inicio_lista >= 0 and fin_lista > inicio_lista:
        return json.loads(texto[inicio_lista:fin_lista + 1])

    raise ValueError("La IA no devolvió JSON válido")


def consultar_pollinations(prompt):
    url = f"https://text.pollinations.ai/{quote(prompt)}"
    request = Request(url, headers={"User-Agent": "testOnlineSupaDjango/1.0"})

    with urlopen(
        request,
        timeout=35,
        context=ssl._create_unverified_context()
    ) as response:
        return response.read().decode("utf-8")


def consultar_languagetool(texto):
    data = urlencode({
        "text": texto[:20000],
        "language": "auto",
        "preferredVariants": "es-ES,en-US"
    }).encode("utf-8")
    request = Request(
        "https://api.languagetool.org/v2/check",
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "testOnlineSupaDjango/1.0"
        },
        method="POST"
    )

    with urlopen(
        request,
        timeout=20,
        context=ssl._create_unverified_context()
    ) as response:
        return json.loads(response.read().decode("utf-8"))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def revisar_ortografia(request):
    texto = (request.data.get("texto") or "").strip()

    if not texto:
        return Response({
            "matches": [],
            "language": None
        })

    try:
        data = consultar_languagetool(texto)
        matches = []

        for match in data.get("matches", [])[:8]:
            replacements = [
                item.get("value")
                for item in match.get("replacements", [])[:5]
                if item.get("value")
            ]

            matches.append({
                "message": match.get("message"),
                "shortMessage": match.get("shortMessage"),
                "offset": match.get("offset"),
                "length": match.get("length"),
                "context": match.get("context", {}),
                "replacements": replacements,
                "rule": match.get("rule", {}).get("description")
            })

        return Response({
            "matches": matches,
            "language": data.get("language")
        })
    except (ValueError, json.JSONDecodeError, HTTPError, URLError) as exc:
        return Response(
            {"detail": "No se pudo revisar la ortografía.", "error": str(exc)},
            status=status.HTTP_502_BAD_GATEWAY
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generar_opciones_seleccion_unica(request):
    enunciado = (request.data.get("enunciado") or "").strip()

    if not enunciado:
        return Response(
            {"detail": "El enunciado es obligatorio."},
            status=status.HTTP_400_BAD_REQUEST
        )

    prompt = f"""
Genera opciones para un item educativo de selección única.
Enunciado: "{enunciado}"

Responde SOLO JSON válido, sin markdown, con esta estructura:
{{
  "opciones": ["opción incorrecta", "opción incorrecta", "opción correcta", "opción incorrecta", "opción incorrecta", "opción incorrecta", "opción incorrecta"],
  "correcta": 3
}}

Reglas:
- Genera exactamente 7 opciones.
- Solo una opción debe ser claramente correcta.
- La propiedad "correcta" debe ser el número de opción correcta, iniciando en 1.
- Las opciones deben ser breves, claras y en español.
"""

    try:
        texto = consultar_pollinations(prompt)
        data = extraer_json_ia(texto)
        opciones = data.get("opciones", [])[:7]
        correcta = int(data.get("correcta"))

        if len(opciones) != 7 or correcta < 1 or correcta > 7:
            raise ValueError("Respuesta incompleta")

        return Response({
            "opciones": opciones,
            "correcta": correcta
        })
    except (ValueError, json.JSONDecodeError, KeyError, TypeError, HTTPError, URLError) as exc:
        return Response(
            {"detail": "No se pudieron generar opciones con IA.", "error": str(exc)},
            status=status.HTTP_502_BAD_GATEWAY
        )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generar_respuestas_unicas(request):
    enunciado = (request.data.get("enunciado") or "").strip()

    if not enunciado:
        return Response(
            {"detail": "El enunciado es obligatorio."},
            status=status.HTTP_400_BAD_REQUEST
        )

    prompt = f"""
Genera respuestas esperadas para un item educativo de respuesta única o respuesta corta.
Enunciado: "{enunciado}"

Responde SOLO JSON válido, sin markdown, con esta estructura:
{{
  "respuestas": ["respuesta esperada 1", "respuesta alternativa válida"]
}}

Reglas:
- Genera entre 1 y 3 respuestas correctas o equivalentes.
- Las respuestas deben ser breves, claras y en español.
- No incluyas respuestas incorrectas.
"""

    try:
        texto = consultar_pollinations(prompt)
        data = extraer_json_ia(texto)
        respuestas = [
            str(respuesta).strip()
            for respuesta in data.get("respuestas", [])[:3]
            if str(respuesta).strip()
        ]

        if not respuestas:
            raise ValueError("Respuesta incompleta")

        return Response({
            "respuestas": respuestas
        })
    except (ValueError, json.JSONDecodeError, KeyError, TypeError, HTTPError, URLError) as exc:
        return Response(
            {"detail": "No se pudieron generar respuestas con IA.", "error": str(exc)},
            status=status.HTTP_502_BAD_GATEWAY
        )
