from decimal import Decimal


def calcular_nota(intento):
    total = Decimal(0)
    obtenido = Decimal(0)

    # selección única
    for r in intento.respuestas_seleccion.all():
        correcto = r.item.numero_opcion_correcta
        puntaje = r.puntaje_posible or Decimal(1)

        total += puntaje

        if r.respuesta == correcto:
            r.puntaje_ganado = puntaje
            obtenido += puntaje
        else:
            r.puntaje_ganado = Decimal(0)

        r.save()

    # abiertas (manual por ahora)
    for r in intento.respuestas_abiertas.all():
        if r.puntaje_posible:
            total += r.puntaje_posible
            obtenido += r.puntaje_ganado or Decimal(0)

    # identificación (simplificado)
    for r in intento.respuestas_identificacion.all():
        if r.puntaje_posible:
            total += r.puntaje_posible
            obtenido += r.puntaje_ganado or Decimal(0)

    # pareo (simplificado)
    for r in intento.respuestas_pareo.all():
        if r.puntaje_posible:
            total += r.puntaje_posible
            obtenido += r.puntaje_ganado or Decimal(0)

    porcentaje = (obtenido / total * 100) if total > 0 else 0

    intento.puntaje_obtenido = obtenido
    intento.porcentaje_obtenido = porcentaje
    intento.nota_obtenida = porcentaje  # luego puede mapear a escala MEP

    intento.save()

    return intento