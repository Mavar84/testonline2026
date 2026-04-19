export const tiposDocumento = {
  1: { nombre: "Imagen", mime: "image/jpeg", extension: "jpg" },
  2: { nombre: "PDF", mime: "application/pdf", extension: "pdf" },
  3: { nombre: "Video", mime: "video/webm", extension: "webm" },
  4: { nombre: "Audio", mime: "audio/webm", extension: "webm" }
}

export const tipoNumeroPorClave = {
  imagen: 1,
  pdf: 2,
  video: 3,
  audio: 4
}

export function mimePorTipo(tipo) {
  return tiposDocumento[tipo]?.mime || "application/octet-stream"
}

export function extensionPorTipo(tipo) {
  return tiposDocumento[tipo]?.extension || "bin"
}

export function construirDocumentoDataUrl(documento) {
  if (documento?.data_url) return documento.data_url
  const contenido = documento?.contenido || documento?.contenido_base64
  if (!contenido) return ""
  const mime = documento?.mime_type || mimePorTipo(documento?.tipo)
  return `data:${mime};base64,${contenido}`
}

export function crearDocumentoPreview(relacion, documento) {
  const tipo = tiposDocumento[documento.tipo] || tiposDocumento[1]
  return {
    id: relacion.id,
    documentoId: documento.id,
    orden: relacion.orden,
    contexto: relacion.contexto,
    tipo: tipo.nombre,
    extension: tipo.extension,
    url: construirDocumentoDataUrl(documento)
  }
}

export function fileToBase64Limpio(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result.split(",")[1])
    reader.onerror = reject
  })
}

export async function hashArchivo(file) {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
