from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import IntentoPrueba
from pruebas.models import Prueba
from pruebas.models import PruebaAsignacion
import json
import hashlib
import unicodedata
from datetime import timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from difflib import SequenceMatcher
from django.utils import timezone
from django.db import transaction
from django.core.mail import send_mail
from django.conf import settings
from .services import calcular_nota
from items.models import ItemPareoRelacion


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def iniciar_intento(request):
    prueba_id = request.data.get('prueba_id')

    prueba = Prueba.objects.get(id=prueba_id)

    tiene_asignaciones = PruebaAsignacion.objects.filter(prueba=prueba, activo=True).exists()
    esta_asignado = PruebaAsignacion.objects.filter(
        prueba=prueba,
        estudiante=request.user,
        activo=True
    ).exists()

    if tiene_asignaciones and not esta_asignado:
        return Response(
            {"detail": "No tienes esta prueba asignada."},
            status=403
        )

    intento = IntentoPrueba.objects.create(
        estudiante=request.user,
        prueba=prueba
    )

    return Response({
        "intento_id": intento.id
    })


from .models import (
    RespuestaSeleccion,
    RespuestaRespuestaUnica,
    RespuestaIdentificacion,
    RespuestaPareo
)
 

def _obtener_intento_usuario(request, intento_id):
    return IntentoPrueba.objects.get(id=intento_id, estudiante=request.user)


def _fecha_limite_intento(intento):
    return intento.fecha_inicio + timedelta(minutes=intento.prueba.duracion_minutos or 60)


def _tiempo_vencido(intento):
    return timezone.now() > _fecha_limite_intento(intento)


def _normalizar_respuesta(tipo, valor):
    if tipo == "seleccion":
        try:
            return int(valor or 0)
        except (TypeError, ValueError):
            return 0

    if tipo == "abierta":
        if isinstance(valor, list):
            return [str(item) for item in valor]
        if valor in (None, ""):
            return []
        return [str(valor)]

    if tipo in {"identificacion", "pareo"}:
        if isinstance(valor, dict):
            return {str(k): "" if v is None else str(v) for k, v in sorted(valor.items(), key=lambda item: str(item[0]))}
        return {}

    return valor


def _construir_respuestas_normalizadas(prueba_id, intento_id, respuestas):
    normalizadas = []
    for respuesta in respuestas:
        normalizadas.append({
            "tipo": respuesta.get("tipo"),
            "item_id": int(respuesta.get("item_id")),
            "puntaje": str(respuesta.get("puntaje", 1)),
            "respuesta": _normalizar_respuesta(respuesta.get("tipo"), respuesta.get("respuesta")),
        })

    normalizadas.sort(key=lambda item: (item["tipo"], item["item_id"]))
    return {
        "prueba_id": int(prueba_id),
        "intento_id": int(intento_id),
        "respuestas": normalizadas,
    }


def _calcular_hash_entrega(prueba_id, intento_id, respuestas):
    paquete = _construir_respuestas_normalizadas(prueba_id, intento_id, respuestas)
    payload = json.dumps(paquete, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _mapa_items_esperados(prueba):
    esperados = {}

    for relacion in prueba.items_seleccion.select_related("item").all():
        esperados[("seleccion", relacion.item_id)] = {
            "tipo": "seleccion",
            "item_id": relacion.item_id,
            "orden": relacion.orden,
            "puntaje": relacion.puntaje,
            "enunciado": relacion.item.enunciado,
        }

    for relacion in prueba.items_respuesta.select_related("item").all():
        esperados[("abierta", relacion.item_id)] = {
            "tipo": "abierta",
            "item_id": relacion.item_id,
            "orden": relacion.orden,
            "puntaje": relacion.puntaje,
            "enunciado": relacion.item.enunciado,
        }

    for relacion in prueba.items_identificacion.select_related("item").all():
        esperados[("identificacion", relacion.item_id)] = {
            "tipo": "identificacion",
            "item_id": relacion.item_id,
            "orden": relacion.orden,
            "puntaje": relacion.puntaje,
            "enunciado": relacion.item.enunciado,
        }

    for relacion in prueba.items_pareo.select_related("item").all():
        esperados[("pareo", relacion.item_id)] = {
            "tipo": "pareo",
            "item_id": relacion.item_id,
            "orden": relacion.orden,
            "puntaje": relacion.puntaje,
            "enunciado": relacion.item.enunciado,
        }

    return esperados


def _resumen_respuesta_para_correo(tipo, valor):
    normalizada = _normalizar_respuesta(tipo, valor)

    if tipo == "seleccion":
        return f"Opción marcada: {normalizada or 'Sin responder'}"
    if tipo == "abierta":
        if not normalizada:
            return "Sin responder"
        return " | ".join(item or "(vacío)" for item in normalizada)
    if tipo in {"identificacion", "pareo"}:
        if not normalizada:
            return "Sin responder"
        return " | ".join(f"{clave}: {texto or '(vacío)'}" for clave, texto in normalizada.items())
    return str(normalizada)


def _enviar_correo_confirmacion(intento, prueba, respuestas, mapa_esperados):
    estudiante = intento.estudiante
    if not estudiante.email:
        return False, "El estudiante no tiene correo registrado."
    if settings.EMAIL_BACKEND == "django.core.mail.backends.console.EmailBackend":
        return False, "No hay un servicio real de correo configurado todavía."

    lineas = [
        f"Hola {estudiante.get_full_name() or estudiante.username},",
        "",
        "Hemos recibido tu entrega de examen.",
        f"Prueba: {prueba.asignatura or f'Prueba {prueba.id}'}",
        f"ID de intento: {intento.id}",
        f"Fecha de recepción: {timezone.localtime(intento.fecha_fin).strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "Resumen de respuestas enviadas:",
        "",
    ]

    respuestas_ordenadas = sorted(
        respuestas,
        key=lambda item: mapa_esperados.get((item.get("tipo"), int(item.get("item_id"))), {}).get("orden", 9999)
    )

    for respuesta in respuestas_ordenadas:
        clave = (respuesta.get("tipo"), int(respuesta.get("item_id")))
        esperado = mapa_esperados.get(clave, {})
        lineas.append(
            f'{esperado.get("orden", "?")}. {esperado.get("enunciado", "Ítem")} -> '
            f'{_resumen_respuesta_para_correo(respuesta.get("tipo"), respuesta.get("respuesta"))}'
        )

    lineas.extend([
        "",
        "Esta confirmación solo verifica que tu examen fue recibido. La nota no está incluida en este correo.",
    ])

    send_mail(
        subject=f"Confirmación de entrega de examen #{prueba.id}",
        message="\n".join(lineas),
        from_email=None,
        recipient_list=[estudiante.email],
        fail_silently=False,
    )
    return True, ""


def _enviar_correo_calificacion(intento):
    estudiante = intento.estudiante
    if not estudiante.email:
        return False, "El estudiante no tiene correo registrado."
    if settings.EMAIL_BACKEND == "django.core.mail.backends.console.EmailBackend":
        return False, "No hay un servicio real de correo configurado todavía."

    detalle = _detalle_entrega_payload(intento)
    lineas = [
        f"Hola {detalle['estudiante']['nombre']},",
        "",
        "Tu prueba ya fue calificada.",
        f"Prueba: {detalle['prueba']['asignatura'] or f'Prueba {detalle['prueba']['id']}'}",
        f"Puntaje obtenido: {detalle['intento']['puntaje_obtenido']:.2f}",
        f"Porcentaje: {detalle['intento']['porcentaje_obtenido']:.2f}%",
        f"Nota: {detalle['intento']['nota_obtenida']:.2f}",
        "",
        "Detalle de revisión:",
        "",
    ]

    for item in detalle["items"]:
        lineas.append(f"{item['orden']}. {item['enunciado']}")
        lineas.append(f"   Puntaje: {item['puntaje_ganado']:.2f} / {item['puntaje_posible']:.2f}")
        comentario = (item.get("comentario_profesor") or "").strip()
        if comentario:
            lineas.append(f"   Comentario del profesor: {comentario}")
        lineas.append("")

    send_mail(
        subject=f"Calificación de prueba #{detalle['prueba']['id']}",
        message="\n".join(lineas),
        from_email=None,
        recipient_list=[estudiante.email],
        fail_silently=False,
    )
    return True, ""


def _asegurar_prueba_profesor(request, prueba_id):
    prueba = Prueba.objects.get(id=prueba_id)
    if prueba.usuario_id != request.user.id:
        raise PermissionError("Solo el profesor propietario puede revisar esta prueba.")
    return prueba


def _parsear_respuestas_esperadas_texto(respuesta_ejemplo):
    if not respuesta_ejemplo:
        return []

    try:
        data = json.loads(respuesta_ejemplo)
    except (TypeError, ValueError):
        return [str(respuesta_ejemplo).strip()] if str(respuesta_ejemplo).strip() else []

    if isinstance(data, dict) and isinstance(data.get("respuestas"), list):
        return [str(item).strip() for item in data["respuestas"] if str(item).strip()]
    if isinstance(data, list):
        return [str(item).strip() for item in data if str(item).strip()]
    if isinstance(data, str) and data.strip():
        return [data.strip()]
    return []


def _normalizar_texto_comparacion(texto):
    base = unicodedata.normalize("NFKD", str(texto or "").strip().lower())
    sin_tildes = "".join(char for char in base if not unicodedata.combining(char))
    return " ".join(sin_tildes.split())


def _similitud_texto(a, b):
    texto_a = _normalizar_texto_comparacion(a)
    texto_b = _normalizar_texto_comparacion(b)
    if not texto_a and not texto_b:
        return 100.0
    if not texto_a or not texto_b:
        return 0.0
    return round(SequenceMatcher(None, texto_a, texto_b).ratio() * 100, 2)


def _sugerencia_respuesta_unica(item, respuesta_modelo, puntaje_posible):
    esperadas = _parsear_respuestas_esperadas_texto(item.respuesta_ejemplo)
    respuestas_estudiante = respuesta_modelo.respuesta or []
    respuestas_limpias = [str(item).strip() for item in respuestas_estudiante if str(item).strip()]

    if not respuestas_limpias or not esperadas:
        return {
            "similitud": 0.0,
            "puntaje_sugerido": Decimal("0.00"),
            "respuesta_esperada": esperadas,
        }

    mejores = []
    for respuesta in respuestas_limpias:
        mejores.append(max((_similitud_texto(respuesta, esperada) for esperada in esperadas), default=0.0))

    denominador = max(len(esperadas), len(respuestas_limpias), 1)
    similitud = round(sum(mejores) / denominador, 2)
    puntaje = (Decimal(str(similitud)) / Decimal("100")) * Decimal(str(puntaje_posible or 0))
    puntaje = puntaje.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {
        "similitud": similitud,
        "puntaje_sugerido": puntaje,
        "respuesta_esperada": esperadas,
    }


def _sugerencia_pareo(item, respuesta_modelo, puntaje_posible):
    correctas = {
        str(relacion.item_izquierda_id): str(relacion.item_derecha_id)
        for relacion in ItemPareoRelacion.objects.filter(
            item_izquierda__encabezado=item,
            item_derecha__encabezado=item
        )
    }
    try:
        respuesta_estudiante = json.loads(respuesta_modelo.respuesta_texto or "{}")
    except (TypeError, ValueError):
        respuesta_estudiante = {}

    total = max(len(correctas), 1)
    aciertos = sum(1 for izquierda, derecha in correctas.items() if str(respuesta_estudiante.get(izquierda, "")) == derecha)
    porcentaje = round((aciertos / total) * 100, 2)
    puntaje = (Decimal(str(aciertos)) / Decimal(str(total))) * Decimal(str(puntaje_posible or 0))
    puntaje = puntaje.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {
        "aciertos": aciertos,
        "total_relaciones": total,
        "porcentaje": porcentaje,
        "puntaje_sugerido": puntaje,
        "correctas": correctas,
        "respuesta_estudiante": respuesta_estudiante,
    }


def _detalle_entrega_payload(intento):
    prueba = intento.prueba

    relaciones_seleccion = {
        relacion.item_id: relacion
        for relacion in prueba.items_seleccion.select_related("item", "parte").all()
    }
    relaciones_respuesta = {
        relacion.item_id: relacion
        for relacion in prueba.items_respuesta.select_related("item", "parte").all()
    }
    relaciones_identificacion = {
        relacion.item_id: relacion
        for relacion in prueba.items_identificacion.select_related("item", "parte").all()
    }
    relaciones_pareo = {
        relacion.item_id: relacion
        for relacion in prueba.items_pareo.select_related("item", "parte").all()
    }

    items = []

    for respuesta in intento.respuestas_seleccion.select_related("item").all():
        relacion = relaciones_seleccion.get(respuesta.item_id)
        if not relacion:
            continue
        opciones = [
            respuesta.item.opcion1,
            respuesta.item.opcion2,
            respuesta.item.opcion3,
            respuesta.item.opcion4,
            respuesta.item.opcion5,
            respuesta.item.opcion6,
            respuesta.item.opcion7,
        ]
        items.append({
            "tipo": "seleccion",
            "item_id": respuesta.item_id,
            "orden": relacion.orden,
            "parte": relacion.parte.nombre if relacion.parte else "Selección única",
            "enunciado": respuesta.item.enunciado,
            "puntaje_posible": float(respuesta.puntaje_posible or 0),
            "puntaje_ganado": float(respuesta.puntaje_ganado or 0),
            "comentario_profesor": respuesta.comentario_profesor or "",
            "respuesta_estudiante": respuesta.respuesta,
            "respuesta_correcta": respuesta.item.numero_opcion_correcta,
            "opciones": [
                {"indice": indice + 1, "texto": opcion}
                for indice, opcion in enumerate(opciones)
                if opcion
            ],
        })

    for respuesta in intento.respuestas_abiertas.select_related("item").all():
        relacion = relaciones_respuesta.get(respuesta.item_id)
        if not relacion:
            continue
        sugerencia = _sugerencia_respuesta_unica(respuesta.item, respuesta, respuesta.puntaje_posible or 0)
        items.append({
            "tipo": "abierta",
            "item_id": respuesta.item_id,
            "orden": relacion.orden,
            "parte": relacion.parte.nombre if relacion.parte else "Respuesta única",
            "enunciado": respuesta.item.enunciado,
            "puntaje_posible": float(respuesta.puntaje_posible or 0),
            "puntaje_ganado": float(respuesta.puntaje_ganado or 0),
            "comentario_profesor": respuesta.comentario_profesor or "",
            "puntaje_sugerido": float(sugerencia["puntaje_sugerido"]),
            "similitud_sugerida": sugerencia["similitud"],
            "respuesta_estudiante": respuesta.respuesta or [],
            "respuesta_esperada": sugerencia["respuesta_esperada"],
        })

    for respuesta in intento.respuestas_identificacion.select_related("item").all():
        relacion = relaciones_identificacion.get(respuesta.item_id)
        if not relacion:
            continue
        try:
            respuesta_texto = json.loads(respuesta.respuesta_texto or "{}")
        except (TypeError, ValueError):
            respuesta_texto = {}
        componentes = list(
            respuesta.item.componentes.all().order_by("id").values("id", "respuesta_correcta", "coordenada_x", "coordenada_y")
        )
        items.append({
            "tipo": "identificacion",
            "item_id": respuesta.item_id,
            "orden": relacion.orden,
            "parte": relacion.parte.nombre if relacion.parte else "Identificación",
            "enunciado": respuesta.item.enunciado,
            "puntaje_posible": float(respuesta.puntaje_posible or 0),
            "puntaje_ganado": float(respuesta.puntaje_ganado or 0),
            "comentario_profesor": respuesta.comentario_profesor or "",
            "respuesta_estudiante": respuesta_texto,
            "componentes": componentes,
            "imagen": respuesta.item.imagen,
        })

    for respuesta in intento.respuestas_pareo.select_related("item").all():
        relacion = relaciones_pareo.get(respuesta.item_id)
        if not relacion:
            continue
        sugerencia = _sugerencia_pareo(respuesta.item, respuesta, respuesta.puntaje_posible or 0)
        items.append({
            "tipo": "pareo",
            "item_id": respuesta.item_id,
            "orden": relacion.orden,
            "parte": relacion.parte.nombre if relacion.parte else "Pareo",
            "enunciado": respuesta.item.enunciado,
            "puntaje_posible": float(respuesta.puntaje_posible or 0),
            "puntaje_ganado": float(respuesta.puntaje_ganado or 0),
            "comentario_profesor": respuesta.comentario_profesor or "",
            "puntaje_sugerido": float(sugerencia["puntaje_sugerido"]),
            "porcentaje_sugerido": sugerencia["porcentaje"],
            "aciertos": sugerencia["aciertos"],
            "total_relaciones": sugerencia["total_relaciones"],
            "respuesta_estudiante": sugerencia["respuesta_estudiante"],
            "respuesta_correcta": sugerencia["correctas"],
        })

    items.sort(key=lambda item: (item["orden"], item["item_id"]))

    perfil = getattr(intento.estudiante, "perfil", None)
    return {
        "intento": {
            "id": intento.id,
            "fecha_inicio": intento.fecha_inicio,
            "fecha_fin": intento.fecha_fin,
            "puntaje_obtenido": float(intento.puntaje_obtenido or 0),
            "porcentaje_obtenido": float(intento.porcentaje_obtenido or 0),
            "nota_obtenida": float(intento.nota_obtenida or 0),
            "correo_confirmacion_enviado": intento.correo_confirmacion_enviado,
            "fecha_confirmacion_enviada": intento.fecha_confirmacion_enviada,
        },
        "estudiante": {
            "id": intento.estudiante_id,
            "username": intento.estudiante.username,
            "nombre": getattr(perfil, "nombre_completo", None) or intento.estudiante.get_full_name() or intento.estudiante.username,
            "email": intento.estudiante.email,
            "foto_estudiante": getattr(perfil, "foto_estudiante", None),
        },
        "prueba": {
            "id": prueba.id,
            "asignatura": prueba.asignatura,
            "nivel": prueba.nivel,
            "periodo": prueba.periodo,
            "centro_educativo": prueba.centro_educativo,
        },
        "items": items,
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def responder(request):
    intento_id = request.data.get('intento_id')
    tipo = request.data.get('tipo')

    intento = _obtener_intento_usuario(request, intento_id)
    if _tiempo_vencido(intento):
        return Response({"detail": "El tiempo de esta prueba ya venció."}, status=403)

    if tipo == "seleccion":
        RespuestaSeleccion.objects.update_or_create(
            intento=intento,
            item_id=request.data.get('item_id'),
            defaults={
                "respuesta": request.data.get('respuesta'),
                "puntaje_posible": request.data.get('puntaje', 1)
            }
        )

    elif tipo == "abierta":
        RespuestaRespuestaUnica.objects.update_or_create(
            intento=intento,
            item_id=request.data.get('item_id'),
            defaults={
                "respuesta": request.data.get('respuesta'),
                "puntaje_posible": request.data.get('puntaje', 1)
            }
        )

    elif tipo == "identificacion":
        RespuestaIdentificacion.objects.update_or_create(
            intento=intento,
            item_id=request.data.get('item_id'),
            defaults={
                "respuesta_texto": json.dumps(request.data.get('respuesta')),
                "puntaje_posible": request.data.get('puntaje', 1)
            }
        )

    elif tipo == "pareo":
        RespuestaPareo.objects.update_or_create(
            intento=intento,
            item_id=request.data.get('item_id'),
            defaults={
                "respuesta_texto": json.dumps(request.data.get('respuesta')),
                "puntaje_posible": request.data.get('puntaje', 1)
            }
        )

    return Response({"ok": True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def finalizar_intento(request):
    intento_id = request.data.get('intento_id')

    intento = _obtener_intento_usuario(request, intento_id)
    if _tiempo_vencido(intento):
        return Response({"detail": "El tiempo de esta prueba ya venció."}, status=403)

    intento.fecha_fin = timezone.now()
    intento.save()

    calcular_nota(intento)

    return Response({
        "puntaje": intento.puntaje_obtenido,
        "porcentaje": intento.porcentaje_obtenido,
        "nota": intento.nota_obtenida
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def entregar_intento(request):
    prueba_id = request.data.get('prueba_id')
    intento_id = request.data.get('intento_id')
    respuestas = request.data.get('respuestas', [])
    finalizado_en = request.data.get('finalizado_en')
    hash_entrega = request.data.get('hash_entrega')

    prueba = Prueba.objects.get(id=prueba_id)

    tiene_asignaciones = PruebaAsignacion.objects.filter(prueba=prueba, activo=True).exists()
    esta_asignado = PruebaAsignacion.objects.filter(
        prueba=prueba,
        estudiante=request.user,
        activo=True
    ).exists()

    if tiene_asignaciones and not esta_asignado:
        return Response(
            {"detail": "No tienes esta prueba asignada."},
            status=403
        )

    intento = _obtener_intento_usuario(request, intento_id)
    if intento.prueba_id != prueba.id:
        return Response({"detail": "El intento no corresponde a esta prueba."}, status=403)
    if intento.fecha_fin:
        return Response({"detail": "Este intento ya fue entregado."}, status=400)
    if _tiempo_vencido(intento):
        intento.fecha_fin = timezone.now()
        intento.save(update_fields=["fecha_fin"])
        return Response({"detail": "El tiempo de esta prueba ya venció."}, status=403)

    mapa_esperados = _mapa_items_esperados(prueba)
    claves_esperadas = set(mapa_esperados.keys())
    claves_recibidas = set()

    try:
        for respuesta in respuestas:
            tipo = respuesta.get("tipo")
            item_id = int(respuesta.get("item_id"))
            clave = (tipo, item_id)
            if clave not in claves_esperadas:
                return Response({"detail": "Se recibieron respuestas que no pertenecen a esta prueba."}, status=400)
            if clave in claves_recibidas:
                return Response({"detail": "Se recibieron respuestas duplicadas en el envío."}, status=400)
            claves_recibidas.add(clave)
    except (TypeError, ValueError):
        return Response({"detail": "El formato de las respuestas no es válido."}, status=400)

    if claves_recibidas != claves_esperadas:
        faltantes = [
            mapa_esperados[clave]["orden"]
            for clave in sorted(claves_esperadas - claves_recibidas, key=lambda item: mapa_esperados[item]["orden"])
        ]
        return Response(
            {
                "detail": "El envío no incluye todos los ítems esperados. Intenta enviarlo nuevamente.",
                "faltantes": faltantes,
            },
            status=400
        )

    hash_servidor = _calcular_hash_entrega(prueba.id, intento.id, respuestas)
    if not hash_entrega or hash_entrega != hash_servidor:
        return Response(
            {
                "detail": "No pudimos verificar la integridad del envío. Por favor vuelve a enviarlo.",
                "hash_recibido": hash_entrega,
                "hash_servidor": hash_servidor,
            },
            status=409
        )

    with transaction.atomic():
        intento.respuestas_seleccion.all().delete()
        intento.respuestas_abiertas.all().delete()
        intento.respuestas_identificacion.all().delete()
        intento.respuestas_pareo.all().delete()

        for respuesta in respuestas:
            tipo = respuesta.get("tipo")
            item_id = int(respuesta.get("item_id"))
            puntaje = respuesta.get("puntaje", 1)
            valor = _normalizar_respuesta(tipo, respuesta.get("respuesta"))

            if tipo == "seleccion":
                RespuestaSeleccion.objects.create(
                    intento=intento,
                    item_id=item_id,
                    respuesta=valor,
                    puntaje_posible=puntaje
                )
            elif tipo == "abierta":
                RespuestaRespuestaUnica.objects.create(
                    intento=intento,
                    item_id=item_id,
                    respuesta=valor,
                    puntaje_posible=puntaje
                )
            elif tipo == "identificacion":
                RespuestaIdentificacion.objects.create(
                    intento=intento,
                    item_id=item_id,
                    respuesta_texto=json.dumps(valor),
                    puntaje_posible=puntaje
                )
            elif tipo == "pareo":
                RespuestaPareo.objects.create(
                    intento=intento,
                    item_id=item_id,
                    respuesta_texto=json.dumps(valor),
                    puntaje_posible=puntaje
                )

        intento.fecha_fin = timezone.now()
        intento.hash_entrega = hash_servidor
        intento.save(update_fields=["fecha_fin", "hash_entrega"])

        calcular_nota(intento)

    correo_enviado = False
    correo_error = ""
    try:
        correo_enviado, correo_error = _enviar_correo_confirmacion(intento, prueba, respuestas, mapa_esperados)
    except Exception:
        correo_enviado = False
        correo_error = "No se pudo enviar el correo de confirmación."

    if correo_enviado:
        intento.correo_confirmacion_enviado = True
        intento.fecha_confirmacion_enviada = timezone.now()
        intento.save(update_fields=["correo_confirmacion_enviado", "fecha_confirmacion_enviada"])

    return Response({
        "intento_id": intento.id,
        "puntaje": intento.puntaje_obtenido,
        "porcentaje": intento.porcentaje_obtenido,
        "nota": intento.nota_obtenida,
        "finalizado_en": finalizado_en,
        "fecha_limite_servidor": _fecha_limite_intento(intento),
        "hash_entrega": hash_servidor,
        "correo_confirmacion_enviado": correo_enviado,
        "correo_confirmacion_error": correo_error,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def listar_entregas_profesor(request, prueba_id):
    try:
        prueba = _asegurar_prueba_profesor(request, prueba_id)
    except Prueba.DoesNotExist:
        return Response({"detail": "La prueba no existe."}, status=404)
    except PermissionError as error:
        return Response({"detail": str(error)}, status=403)

    intentos = IntentoPrueba.objects.filter(
        prueba=prueba,
        fecha_fin__isnull=False
    ).select_related("estudiante", "estudiante__perfil").order_by("-fecha_fin", "-id")

    data = []
    for intento in intentos:
        perfil = getattr(intento.estudiante, "perfil", None)
        data.append({
            "intento_id": intento.id,
            "estudiante_id": intento.estudiante_id,
            "estudiante_username": intento.estudiante.username,
            "estudiante_nombre": getattr(perfil, "nombre_completo", None) or intento.estudiante.get_full_name() or intento.estudiante.username,
            "estudiante_email": intento.estudiante.email,
            "fecha_inicio": intento.fecha_inicio,
            "fecha_fin": intento.fecha_fin,
            "puntaje_obtenido": float(intento.puntaje_obtenido or 0),
            "porcentaje_obtenido": float(intento.porcentaje_obtenido or 0),
            "nota_obtenida": float(intento.nota_obtenida or 0),
            "correo_confirmacion_enviado": intento.correo_confirmacion_enviado,
        })

    return Response({
        "prueba": {
            "id": prueba.id,
            "asignatura": prueba.asignatura,
            "nivel": prueba.nivel,
            "periodo": prueba.periodo,
            "centro_educativo": prueba.centro_educativo,
            "fecha_aplicacion": prueba.fecha_aplicacion,
            "duracion_minutos": prueba.duracion_minutos or 60,
        },
        "entregas": data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def detalle_entrega_profesor(request, prueba_id, intento_id):
    try:
        prueba = _asegurar_prueba_profesor(request, prueba_id)
        intento = IntentoPrueba.objects.select_related("estudiante", "estudiante__perfil", "prueba").get(
            id=intento_id,
            prueba=prueba,
            fecha_fin__isnull=False
        )
    except Prueba.DoesNotExist:
        return Response({"detail": "La prueba no existe."}, status=404)
    except IntentoPrueba.DoesNotExist:
        return Response({"detail": "La entrega no existe."}, status=404)
    except PermissionError as error:
        return Response({"detail": str(error)}, status=403)

    return Response(_detalle_entrega_payload(intento))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def autoevaluar_entrega_profesor(request, prueba_id, intento_id):
    try:
        prueba = _asegurar_prueba_profesor(request, prueba_id)
        intento = IntentoPrueba.objects.select_related("prueba").get(
            id=intento_id,
            prueba=prueba,
            fecha_fin__isnull=False
        )
    except Prueba.DoesNotExist:
        return Response({"detail": "La prueba no existe."}, status=404)
    except IntentoPrueba.DoesNotExist:
        return Response({"detail": "La entrega no existe."}, status=404)
    except PermissionError as error:
        return Response({"detail": str(error)}, status=403)

    for respuesta in intento.respuestas_pareo.select_related("item").all():
        sugerencia = _sugerencia_pareo(respuesta.item, respuesta, respuesta.puntaje_posible or 0)
        respuesta.puntaje_ganado = sugerencia["puntaje_sugerido"]
        respuesta.save(update_fields=["puntaje_ganado"])

    for respuesta in intento.respuestas_abiertas.select_related("item").all():
        sugerencia = _sugerencia_respuesta_unica(respuesta.item, respuesta, respuesta.puntaje_posible or 0)
        if respuesta.puntaje_ganado in (None, Decimal("0"), Decimal("0.00")):
            respuesta.puntaje_ganado = sugerencia["puntaje_sugerido"]
            respuesta.save(update_fields=["puntaje_ganado"])

    calcular_nota(intento)
    intento.refresh_from_db()
    return Response(_detalle_entrega_payload(intento))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def guardar_evaluacion_profesor(request, prueba_id, intento_id):
    try:
        prueba = _asegurar_prueba_profesor(request, prueba_id)
        intento = IntentoPrueba.objects.select_related("prueba").get(
            id=intento_id,
            prueba=prueba,
            fecha_fin__isnull=False
        )
    except Prueba.DoesNotExist:
        return Response({"detail": "La prueba no existe."}, status=404)
    except IntentoPrueba.DoesNotExist:
        return Response({"detail": "La entrega no existe."}, status=404)
    except PermissionError as error:
        return Response({"detail": str(error)}, status=403)

    evaluaciones = request.data.get("items", [])
    if not isinstance(evaluaciones, list):
        return Response({"detail": "El formato de evaluación no es válido."}, status=400)

    seleccion = {respuesta.item_id: respuesta for respuesta in intento.respuestas_seleccion.all()}
    abiertas = {respuesta.item_id: respuesta for respuesta in intento.respuestas_abiertas.all()}
    identificacion = {respuesta.item_id: respuesta for respuesta in intento.respuestas_identificacion.all()}
    pareo = {respuesta.item_id: respuesta for respuesta in intento.respuestas_pareo.all()}

    try:
        with transaction.atomic():
            for evaluacion in evaluaciones:
                tipo = evaluacion.get("tipo")
                item_id = int(evaluacion.get("item_id"))
                puntaje = Decimal(str(evaluacion.get("puntaje_ganado", 0)))
                comentario = str(evaluacion.get("comentario_profesor", "") or "").strip()
                destino = None

                if tipo == "seleccion":
                    destino = seleccion.get(item_id)
                elif tipo == "abierta":
                    destino = abiertas.get(item_id)
                elif tipo == "identificacion":
                    destino = identificacion.get(item_id)
                elif tipo == "pareo":
                    destino = pareo.get(item_id)

                if not destino:
                    continue

                maximo = Decimal(str(destino.puntaje_posible or 0))
                if puntaje < 0 or puntaje > maximo:
                    return Response(
                        {"detail": f"El puntaje del ítem {item_id} debe estar entre 0 y {maximo}."},
                        status=400
                    )

                destino.puntaje_ganado = puntaje.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                destino.comentario_profesor = comentario or None
                destino.save(update_fields=["puntaje_ganado", "comentario_profesor"])

            calcular_nota(intento)
            intento.refresh_from_db()
    except (InvalidOperation, TypeError, ValueError):
        return Response({"detail": "Se recibieron puntajes inválidos."}, status=400)

    return Response(_detalle_entrega_payload(intento))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def enviar_calificacion_profesor(request, prueba_id, intento_id):
    try:
        prueba = _asegurar_prueba_profesor(request, prueba_id)
        intento = IntentoPrueba.objects.select_related("prueba", "estudiante", "estudiante__perfil").get(
            id=intento_id,
            prueba=prueba,
            fecha_fin__isnull=False
        )
    except Prueba.DoesNotExist:
        return Response({"detail": "La prueba no existe."}, status=404)
    except IntentoPrueba.DoesNotExist:
        return Response({"detail": "La entrega no existe."}, status=404)
    except PermissionError as error:
        return Response({"detail": str(error)}, status=403)

    try:
        enviado, error_correo = _enviar_correo_calificacion(intento)
    except Exception:
        enviado, error_correo = False, "No se pudo enviar el correo de calificación."

    if enviado:
        intento.correo_calificacion_enviado = True
        intento.fecha_calificacion_enviada = timezone.now()
        intento.save(update_fields=["correo_calificacion_enviado", "fecha_calificacion_enviada"])

    return Response({
        "ok": enviado,
        "detail": "Calificación enviada por correo." if enviado else error_correo,
        "correo_calificacion_enviado": enviado,
    }, status=200 if enviado else 400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def detalle_entrega_estudiante(request, intento_id):
    try:
        intento = IntentoPrueba.objects.select_related("prueba", "estudiante", "estudiante__perfil").get(
            id=intento_id,
            estudiante=request.user,
            fecha_fin__isnull=False
        )
    except IntentoPrueba.DoesNotExist:
        return Response({"detail": "La entrega no existe."}, status=404)

    return Response(_detalle_entrega_payload(intento))
