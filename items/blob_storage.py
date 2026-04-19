import base64
import hashlib
from uuid import uuid4

from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError
from azure.storage.blob import BlobServiceClient
from django.conf import settings


TIPO_MIME = {
    1: "image/jpeg",
    2: "application/pdf",
    3: "video/webm",
    4: "audio/webm",
}

TIPO_EXTENSION = {
    1: "jpg",
    2: "pdf",
    3: "webm",
    4: "webm",
}


def mime_por_tipo(tipo):
    return TIPO_MIME.get(tipo, "application/octet-stream")


def extension_por_tipo(tipo):
    return TIPO_EXTENSION.get(tipo, "bin")


def get_blob_service_client():
    connection_string = getattr(settings, "AZURE_STORAGE_CONNECTION_STRING", "")
    if connection_string:
        return BlobServiceClient.from_connection_string(connection_string)

    return BlobServiceClient(
        account_url=settings.AZURE_BLOB_ENDPOINT,
        credential=settings.AZURE_BLOB_ACCOUNT_KEY,
    )


def get_container_client():
    service_client = get_blob_service_client()
    container_client = service_client.get_container_client(settings.AZURE_BLOB_CONTAINER)
    try:
        container_client.create_container()
    except ResourceExistsError:
        pass
    return container_client


def construir_blob_name(documento_hash, tipo):
    extension = extension_por_tipo(tipo)
    base_name = documento_hash or uuid4().hex
    return f"documentos/{base_name}.{extension}"


def upload_documento_base64(contenido_base64, tipo, mime_type=None, documento_hash=None):
    contenido_bytes = base64.b64decode(contenido_base64)
    mime = mime_type or mime_por_tipo(tipo)
    blob_name = construir_blob_name(documento_hash, tipo)
    blob_client = get_container_client().get_blob_client(blob_name)
    blob_client.upload_blob(
        contenido_bytes,
        overwrite=True,
        content_type=mime,
    )
    return {
        "blob_name": blob_name,
        "mime_type": mime,
        "size_bytes": len(contenido_bytes),
    }


def download_documento_base64(blob_name):
    blob_client = get_container_client().get_blob_client(blob_name)
    contenido_bytes = blob_client.download_blob().readall()
    return base64.b64encode(contenido_bytes).decode("utf-8")


def delete_documento_blob(blob_name):
    if not blob_name:
        return
    blob_client = get_container_client().get_blob_client(blob_name)
    try:
        blob_client.delete_blob()
    except ResourceNotFoundError:
        pass


def hash_from_base64(contenido_base64):
    return hashlib.sha256(base64.b64decode(contenido_base64)).hexdigest()
