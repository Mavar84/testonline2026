import json
from collections import OrderedDict
from datetime import timedelta
from django.core import signing

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import (
    Prueba,
    PruebaParte,
    PruebaItemSeleccion,
    PruebaItemRespuesta,
    PruebaItemIdentificacion,
    PruebaItemPareo,
    PruebaAsignacion
)
from .serializers import (
    PruebaSerializer,
    PruebaParteSerializer,
    PruebaItemSeleccionSerializer,
    PruebaItemRespuestaSerializer,
    PruebaItemIdentificacionSerializer,
    PruebaItemPareoSerializer,
    PruebaAsignacionSerializer
)


class PruebaViewSet(viewsets.ModelViewSet):
    queryset = Prueba.objects.all().order_by('id')
    serializer_class = PruebaSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)


class PruebaItemSeleccionViewSet(viewsets.ModelViewSet):
    queryset = PruebaItemSeleccion.objects.all().order_by('id')
    serializer_class = PruebaItemSeleccionSerializer
    permission_classes = [IsAuthenticated]


class PruebaParteViewSet(viewsets.ModelViewSet):
    queryset = PruebaParte.objects.all().order_by('prueba_id', 'orden', 'id')
    serializer_class = PruebaParteSerializer
    permission_classes = [IsAuthenticated]


class PruebaItemRespuestaViewSet(viewsets.ModelViewSet):
    queryset = PruebaItemRespuesta.objects.all().order_by('id')
    serializer_class = PruebaItemRespuestaSerializer
    permission_classes = [IsAuthenticated]


class PruebaItemIdentificacionViewSet(viewsets.ModelViewSet):
    queryset = PruebaItemIdentificacion.objects.all().order_by('id')
    serializer_class = PruebaItemIdentificacionSerializer
    permission_classes = [IsAuthenticated]


class PruebaItemPareoViewSet(viewsets.ModelViewSet):
    queryset = PruebaItemPareo.objects.all().order_by('id')
    serializer_class = PruebaItemPareoSerializer
    permission_classes = [IsAuthenticated]
    
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from items.models import ItemPareoRelacion
from items.document_service import obtener_contenido_documento_base64
from django.utils import timezone
from respuestas.models import IntentoPrueba
from usuarios.face_auth import comparar_fotos

EXAM_ACCESS_SALT = "exam-access"
EXAM_ACCESS_MAX_AGE_SECONDS = 300


def _documento_payload(relacion):
    documento = relacion.documento
    return {
        "id": documento.id,
        "orden": relacion.orden or 0,
        "contexto": relacion.contexto,
        "tipo": documento.tipo,
        "descripcion": documento.descripcion,
        "mime_type": documento.mime_type,
        "contenido": obtener_contenido_documento_base64(documento),
    }


def _parsear_respuestas_esperadas(texto):
    if not texto:
        return []
    try:
        data = json.loads(texto)
    except (TypeError, ValueError):
        return [texto]

    if isinstance(data, list):
        return [str(item).strip() for item in data if str(item).strip()]
    if isinstance(data, str) and data.strip():
        return [data.strip()]
    return []


def _construir_partes(items):
    partes = OrderedDict()
    nombres = {
        "seleccion": "Selección única",
        "abierta": "Respuesta única",
        "identificacion": "Identificación",
        "pareo": "Pareo",
    }

    for item in items:
        tipo = item["tipo"]
        if tipo not in partes:
            partes[tipo] = {
                "id": tipo,
                "titulo": nombres.get(tipo, tipo.title()),
                "tipo": tipo,
                "item_keys": [],
            }
        partes[tipo]["item_keys"].append(f'{item["tipo"]}-{item["id"]}')

    return list(partes.values())


def _construir_partes_guardadas(prueba):
    partes_guardadas = list(prueba.partes.all().order_by("orden", "id"))
    if not partes_guardadas:
        return []

    relaciones_por_tipo = {
        "seleccion": list(prueba.items_seleccion.select_related("item", "parte").all()),
        "respuesta": list(prueba.items_respuesta.select_related("item", "parte").all()),
        "identificacion": list(prueba.items_identificacion.select_related("item", "parte").all()),
        "pareo": list(prueba.items_pareo.select_related("item", "parte").all()),
    }

    partes = []
    for parte in partes_guardadas:
        relaciones = sorted(
            [
                relacion
                for relacion in relaciones_por_tipo.get(parte.tipo, [])
                if relacion.parte_id == parte.id
            ],
            key=lambda relacion: (relacion.orden, relacion.id)
        )
        tipo_item = "abierta" if parte.tipo == "respuesta" else parte.tipo
        partes.append({
            "id": f"parte-{parte.id}",
            "titulo": parte.nombre,
            "tipo": tipo_item,
            "item_keys": [f"{tipo_item}-{relacion.item_id}" for relacion in relaciones],
        })

    return partes


def _asegurar_intento_activo(estudiante, prueba):
    intento = IntentoPrueba.objects.filter(
        estudiante=estudiante,
        prueba=prueba,
        fecha_fin__isnull=True
    ).order_by("-fecha_inicio").first()

    if intento:
        return intento

    return IntentoPrueba.objects.create(
        estudiante=estudiante,
        prueba=prueba
    )


def _intento_entregado(estudiante, prueba):
    return IntentoPrueba.objects.filter(
        estudiante=estudiante,
        prueba=prueba,
        fecha_fin__isnull=False
    ).order_by("-fecha_fin", "-id").first()


def _fecha_limite_intento(prueba, intento):
    return intento.fecha_inicio + timedelta(minutes=prueba.duracion_minutos or 60)


def _ventana_aplicacion(prueba):
    if not prueba.fecha_aplicacion:
        return None, None
    inicio = prueba.fecha_aplicacion
    fin = inicio + timedelta(minutes=prueba.duracion_minutos or 60)
    return inicio, fin


def _estado_aplicacion(prueba):
    inicio, fin = _ventana_aplicacion(prueba)
    ahora = timezone.now()
    if not inicio:
        return {
            "habilitada": True,
            "inicio": None,
            "fin": None,
            "mensaje": "",
        }
    if ahora < inicio:
        return {
            "habilitada": False,
            "inicio": inicio,
            "fin": fin,
            "mensaje": "La prueba aún no está habilitada para iniciar.",
        }
    if ahora > fin:
        return {
            "habilitada": False,
            "inicio": inicio,
            "fin": fin,
            "mensaje": "La ventana de aplicación de esta prueba ya cerró.",
        }
    return {
        "habilitada": True,
        "inicio": inicio,
        "fin": fin,
        "mensaje": "",
    }


class PruebaViewSet(viewsets.ModelViewSet):
    queryset = Prueba.objects.all().order_by('id')
    serializer_class = PruebaSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @action(detail=True, methods=['get'])
    def completa(self, request, pk=None):
        prueba = self.get_object()
        ahora = timezone.now()
        es_propietario = request.user.id == prueba.usuario_id
        intento = None
        fecha_limite = None

        if not es_propietario:
            access_token = request.headers.get("X-Exam-Access", "")
            try:
                access_data = signing.loads(
                    access_token,
                    salt=EXAM_ACCESS_SALT,
                    max_age=EXAM_ACCESS_MAX_AGE_SECONDS
                )
            except signing.SignatureExpired:
                return Response({"detail": "La validación previa expiró. Vuelve a verificar tu rostro."}, status=status.HTTP_401_UNAUTHORIZED)
            except signing.BadSignature:
                return Response({"detail": "No se recibió una validación de acceso válida."}, status=status.HTTP_401_UNAUTHORIZED)

            if access_data.get("user_id") != request.user.id or access_data.get("prueba_id") != prueba.id:
                return Response({"detail": "La validación de acceso no corresponde a esta prueba."}, status=status.HTTP_401_UNAUTHORIZED)

            intento_entregado = _intento_entregado(request.user, prueba)
            if intento_entregado:
                return Response(
                    {
                        "detail": "Esta prueba ya fue entregada previamente y quedó deshabilitada para nuevos ingresos.",
                        "intento_id": intento_entregado.id,
                        "fecha_entrega": intento_entregado.fecha_fin,
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

            estado_aplicacion = _estado_aplicacion(prueba)
            if not estado_aplicacion["habilitada"]:
                return Response(
                    {
                        "detail": estado_aplicacion["mensaje"],
                        "fecha_aplicacion": estado_aplicacion["inicio"],
                        "fecha_cierre": estado_aplicacion["fin"],
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

            intento = _asegurar_intento_activo(request.user, prueba)
            fecha_limite = _fecha_limite_intento(prueba, intento)

            if ahora > fecha_limite:
                return Response(
                    {
                        "detail": "El tiempo de esta prueba ya venció.",
                        "intento_id": intento.id,
                        "fecha_inicio_servidor": intento.fecha_inicio,
                        "fecha_limite_servidor": fecha_limite,
                        "tiempo_restante_segundos": 0,
                    },
                    status=status.HTTP_403_FORBIDDEN
                )

        items = []

        # selección única
        seleccion_relaciones = {
            rel.item_id: sorted(
                [_documento_payload(doc_rel) for doc_rel in rel.item.documentos.select_related("documento").all()],
                key=lambda doc: (doc["orden"], doc["id"])
            )
            for rel in prueba.items_seleccion.select_related("item").all()
        }
        for p in prueba.items_seleccion.select_related("item").all():
            item = p.item
            opciones = [
                item.opcion1,
                item.opcion2,
                item.opcion3,
                item.opcion4,
                item.opcion5,
                item.opcion6,
                item.opcion7,
            ]
            items.append({
                "tipo": "seleccion",
                "orden": p.orden,
                "puntaje": p.puntaje,
                "id": item.id,
                "enunciado": item.enunciado,
                "usa_latex": item.usa_latex,
                "opciones": [
                    {"indice": index + 1, "texto": opcion}
                    for index, opcion in enumerate(opciones)
                    if opcion
                ],
                "documentos": seleccion_relaciones.get(item.id, []),
            })

        # respuesta abierta
        for p in prueba.items_respuesta.select_related("item").all():
            item = p.item
            respuestas_esperadas = _parsear_respuestas_esperadas(item.respuesta_ejemplo)
            items.append({
                "tipo": "abierta",
                "orden": p.orden,
                "puntaje": p.puntaje,
                "id": item.id,
                "enunciado": item.enunciado,
                "usa_latex": item.usa_latex,
                "cantidad_respuestas": max(len(respuestas_esperadas), 1),
                "documentos": sorted(
                    [_documento_payload(doc_rel) for doc_rel in item.documentos.select_related("documento").all()],
                    key=lambda doc: (doc["orden"], doc["id"])
                ),
            })

        # identificación
        for p in prueba.items_identificacion.select_related("item").all():
            item = p.item
            componentes = item.componentes.all().order_by("id")

            items.append({
                "tipo": "identificacion",
                "orden": p.orden,
                "puntaje": p.puntaje,
                "id": item.id,
                "enunciado": item.enunciado,
                "imagen": item.imagen,
                "componentes": [
                    {
                        "id": c.id,
                        "numero": index + 1,
                        "x": c.coordenada_x,
                        "y": c.coordenada_y
                    } for index, c in enumerate(componentes)
                ],
                "documentos": sorted(
                    [_documento_payload(doc_rel) for doc_rel in item.documentos.select_related("documento").all()],
                    key=lambda doc: (doc["orden"], doc["id"])
                ),
            })

        # pareo
        for p in prueba.items_pareo.select_related("item").all():
            item = p.item
            izquierdas = []
            derechas = []

            for index, relacion in enumerate(
                ItemPareoRelacion.objects.filter(
                    item_izquierda__encabezado=item,
                    item_derecha__encabezado=item
                ).select_related("item_izquierda", "item_derecha")
            ):
                izquierda = {
                    "id": relacion.item_izquierda.id,
                    "texto": relacion.item_izquierda.texto,
                    "numero": index + 1,
                }
                derecha = {
                    "id": relacion.item_derecha.id,
                    "texto": relacion.item_derecha.texto,
                }
                izquierdas.append(izquierda)
                derechas.append(derecha)

            items.append({
                "tipo": "pareo",
                "orden": p.orden,
                "puntaje": p.puntaje,
                "id": item.id,
                "enunciado": item.enunciado,
                "izquierda": izquierdas,
                "derecha": derechas,
                "documentos": sorted(
                    [_documento_payload(doc_rel) for doc_rel in item.documentos.select_related("documento").all()],
                    key=lambda doc: (doc["orden"], doc["id"])
                ),
            })

        # ordenar por orden
        items.sort(key=lambda x: x["orden"])

        estudiante = getattr(request.user, "perfil", None)
        partes = _construir_partes_guardadas(prueba) or _construir_partes(items)
        return Response({
            "prueba": {
                "id": prueba.id,
                "asignatura": prueba.asignatura,
                "nivel": prueba.nivel,
                "periodo": prueba.periodo,
                "centro_educativo": prueba.centro_educativo,
                "fecha_aplicacion": prueba.fecha_aplicacion,
                "puntos_totales": prueba.puntos_totales,
                "duracion_minutos": prueba.duracion_minutos or 60,
            },
            "intento": (
                {
                    "id": intento.id,
                    "fecha_inicio_servidor": intento.fecha_inicio,
                    "fecha_limite_servidor": fecha_limite,
                    "tiempo_restante_segundos": max(0, int((fecha_limite - ahora).total_seconds())),
                }
                if intento else None
            ),
            "estudiante": {
                "username": request.user.username,
                "nombre": getattr(estudiante, "nombre_completo", None) or request.user.get_full_name() or request.user.username,
                "foto_estudiante": getattr(estudiante, "foto_estudiante", None),
            },
            "partes": partes,
            "items": items
        })

    @action(detail=True, methods=['post'])
    def validar_ingreso(self, request, pk=None):
        prueba = self.get_object()

        tiene_asignaciones = PruebaAsignacion.objects.filter(prueba=prueba, activo=True).exists()
        esta_asignado = PruebaAsignacion.objects.filter(
            prueba=prueba,
            estudiante=request.user,
            activo=True
        ).exists()

        if tiene_asignaciones and not esta_asignado:
            return Response({"detail": "No tienes esta prueba asignada."}, status=status.HTTP_403_FORBIDDEN)

        intento_entregado = _intento_entregado(request.user, prueba)
        if intento_entregado:
            return Response(
                {
                    "detail": "Esta prueba ya fue entregada previamente y quedó deshabilitada para nuevos ingresos.",
                    "intento_id": intento_entregado.id,
                    "fecha_entrega": intento_entregado.fecha_fin,
                },
                status=status.HTTP_403_FORBIDDEN
            )

        estado_aplicacion = _estado_aplicacion(prueba)
        if not estado_aplicacion["habilitada"]:
            return Response(
                {
                    "detail": estado_aplicacion["mensaje"],
                    "fecha_aplicacion": estado_aplicacion["inicio"],
                    "fecha_cierre": estado_aplicacion["fin"],
                },
                status=status.HTTP_403_FORBIDDEN
            )

        perfil = getattr(request.user, "perfil", None)
        foto_estudiante = request.data.get("foto_estudiante")
        if not perfil or not perfil.foto_estudiante:
            return Response({"detail": "No hay una foto registrada para este estudiante."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            resultado = comparar_fotos(perfil.foto_estudiante, foto_estudiante)
        except ValueError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({"detail": "No se pudo procesar la validación facial."}, status=status.HTTP_400_BAD_REQUEST)

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

        access_token = signing.dumps(
            {
                "user_id": request.user.id,
                "prueba_id": prueba.id,
                "purpose": EXAM_ACCESS_SALT,
            },
            salt=EXAM_ACCESS_SALT
        )
        return Response({
            "exam_access_token": access_token,
            "similitud": resultado["similitud"],
            "fecha_aplicacion": estado_aplicacion["inicio"],
            "fecha_cierre": estado_aplicacion["fin"],
        })

    @action(detail=True, methods=['get', 'post'])
    def asignaciones(self, request, pk=None):
        prueba = self.get_object()

        if prueba.usuario_id != request.user.id:
            return Response(
                {"detail": "Solo el profesor propietario puede gestionar asignaciones."},
                status=status.HTTP_403_FORBIDDEN
            )

        if request.method.lower() == 'get':
            asignaciones = prueba.asignaciones.filter(activo=True).select_related('estudiante', 'estudiante__perfil').order_by('estudiante__username')
            serializer = PruebaAsignacionSerializer(asignaciones, many=True)
            return Response(serializer.data)

        estudiante_ids = request.data.get('estudiantes', [])
        estudiante_ids = [int(item) for item in estudiante_ids]

        actuales = {a.estudiante_id: a for a in prueba.asignaciones.all()}
        nuevos = set(estudiante_ids)

        for estudiante_id in nuevos:
            asignacion = actuales.get(estudiante_id)
            if asignacion:
                if not asignacion.activo:
                    asignacion.activo = True
                    asignacion.save(update_fields=['activo'])
            else:
                PruebaAsignacion.objects.create(
                    prueba=prueba,
                    estudiante_id=estudiante_id,
                    activo=True
                )

        for estudiante_id, asignacion in actuales.items():
            if estudiante_id not in nuevos and asignacion.activo:
                asignacion.activo = False
                asignacion.save(update_fields=['activo'])

        asignaciones = prueba.asignaciones.filter(activo=True).select_related('estudiante', 'estudiante__perfil').order_by('estudiante__username')
        serializer = PruebaAsignacionSerializer(asignaciones, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def mis_asignadas(self, request):
        asignaciones = PruebaAsignacion.objects.filter(
            estudiante=request.user,
            activo=True
        ).select_related('prueba', 'prueba__usuario').order_by('-prueba__fecha_aplicacion', '-prueba__id')

        data = []
        for asignacion in asignaciones:
            prueba = asignacion.prueba
            estado_aplicacion = _estado_aplicacion(prueba)
            intento_entregado = _intento_entregado(request.user, prueba)
            ya_realizada = intento_entregado is not None

            data.append({
                "asignacion_id": asignacion.id,
                "prueba_id": prueba.id,
                "asignatura": prueba.asignatura,
                "nivel": prueba.nivel,
                "periodo": prueba.periodo,
                "centro_educativo": prueba.centro_educativo,
                "fecha_aplicacion": prueba.fecha_aplicacion,
                "puntos_totales": prueba.puntos_totales,
                "duracion_minutos": prueba.duracion_minutos or 60,
                "profesor": prueba.usuario.username,
                "acceso_habilitado": estado_aplicacion["habilitada"] and not ya_realizada,
                "ya_realizada": ya_realizada,
                "fecha_entrega": intento_entregado.fecha_fin if intento_entregado else None,
                "intento_id": intento_entregado.id if intento_entregado else None,
                "puntaje_obtenido": float(intento_entregado.puntaje_obtenido or 0) if intento_entregado else None,
                "porcentaje_obtenido": float(intento_entregado.porcentaje_obtenido or 0) if intento_entregado else None,
                "nota_obtenida": float(intento_entregado.nota_obtenida or 0) if intento_entregado else None,
                "correo_calificacion_enviado": intento_entregado.correo_calificacion_enviado if intento_entregado else False,
                "mensaje_estado": (
                    "Ya realizaste esta prueba."
                    if ya_realizada
                    else estado_aplicacion["mensaje"]
                ),
            })

        return Response(data)
