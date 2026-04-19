import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

from .face_auth_local import comparar_fotos_local


def _comparar_por_servicio(data_url_guardada, data_url_nueva):
    if not settings.FACE_SERVICE_URL:
        raise RuntimeError("No hay servicio facial configurado.")

    payload = json.dumps(
        {
            "foto_registrada": data_url_guardada,
            "foto_actual": data_url_nueva,
        }
    ).encode("utf-8")
    request = Request(
        settings.FACE_SERVICE_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "testonline-backend/1.0",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=settings.FACE_SERVICE_TIMEOUT_SECONDS) as response:
            body = response.read().decode("utf-8")
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="ignore")
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            data = {}
        if error.code == 400:
            raise ValueError(data.get("detail") or "No se pudo procesar la validación facial.") from error
        raise RuntimeError(data.get("detail") or "El servicio facial respondió con error.") from error
    except URLError as error:
        raise RuntimeError("No se pudo conectar con el servicio facial.") from error

    try:
        return json.loads(body)
    except json.JSONDecodeError as error:
        raise RuntimeError("El servicio facial devolvió una respuesta inválida.") from error


def comparar_fotos(data_url_guardada, data_url_nueva):
    if settings.FACE_SERVICE_URL:
        try:
            return _comparar_por_servicio(data_url_guardada, data_url_nueva)
        except Exception:
            if settings.FACE_SERVICE_STRICT:
                raise

    return comparar_fotos_local(data_url_guardada, data_url_nueva)
