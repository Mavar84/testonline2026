from .blob_storage import delete_documento_blob
from .blob_storage import download_documento_base64


def obtener_contenido_documento_base64(documento):
    if not documento.blob_name:
        return ""
    return download_documento_base64(documento.blob_name)


def borrar_blob_si_no_se_usa(blob_name, documento_modelo, documento_id_excluir=None):
    if not blob_name:
        return

    queryset = documento_modelo.objects.filter(blob_name=blob_name)
    if documento_id_excluir is not None:
        queryset = queryset.exclude(id=documento_id_excluir)

    if queryset.exists():
        return

    delete_documento_blob(blob_name)
