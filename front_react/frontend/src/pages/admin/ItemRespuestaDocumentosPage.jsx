import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import api from "../../services/api"
import AdminPageHeader from "../../components/AdminPageHeader"
import { crearDocumentoPreview } from "../../services/documentos"

export default function ItemRespuestaDocumentosPage() {
  const { id } = useParams()
  const [item, setItem] = useState(null)
  const [documentos, setDocumentos] = useState([])
  const [error, setError] = useState("")

  const documentosOrdenados = useMemo(() => {
    return [...documentos].sort((a, b) => (a.orden || 0) - (b.orden || 0))
  }, [documentos])

  useEffect(() => {
    const cargarDocumentos = async () => {
      try {
        setError("")

        const [itemRes, relacionesRes] = await Promise.all([
          api.get(`/items/respuesta-unica/${id}/`),
          api.get("/items/respuesta-unica-documentos/")
        ])

        const relaciones = relacionesRes.data.filter(
          (relacion) => relacion.item === parseInt(id)
        )

        const documentosRes = await Promise.all(
          relaciones.map((relacion) => api.get(`/items/documentos/${relacion.documento}/`))
        )

        const previews = relaciones.map((relacion, index) =>
          crearDocumentoPreview(relacion, documentosRes[index].data)
        )

        setItem(itemRes.data)
        setDocumentos(previews)
      } catch (err) {
        console.error(err)
        setError("No se pudieron cargar los documentos del item.")
      }
    }

    cargarDocumentos()
  }, [id])

  const renderMiniatura = (doc) => {
    if (!doc.url) {
      return <div className="document-thumb-placeholder">Sin archivo</div>
    }

    if (doc.tipo === "Imagen") {
      return <img src={doc.url} alt={`Documento ${doc.orden || doc.documentoId}`} />
    }

    if (doc.tipo === "PDF") {
      return <iframe src={doc.url} title={`Documento PDF ${doc.documentoId}`} />
    }

    if (doc.tipo === "Video") {
      return <video src={doc.url} controls />
    }

    if (doc.tipo === "Audio") {
      return (
        <div className="document-audio-thumb">
          <span>Audio</span>
          <audio src={doc.url} controls />
        </div>
      )
    }

    return <div className="document-thumb-placeholder">{doc.tipo}</div>
  }

  return (
    <div className="bg-gradient">
      <div className="container">
        <AdminPageHeader
          title="Documentos de Respuesta Única"
          subtitle="Previsualiza los archivos asociados al ítem."
        />

        <div className="card">
          <h2>Documentos del item de respuesta unica #{id}</h2>

          {item && (
            <p className="document-item-summary">
              {item.enunciado}
            </p>
          )}

          {error && <p className="document-error">{error}</p>}

          {!error && documentosOrdenados.length === 0 && (
            <p>Este item no tiene documentos asociados.</p>
          )}

          <div className="documents-grid">
            {documentosOrdenados.map((doc) => (
              <article className="document-card" key={doc.id}>
                <div className="document-thumb">
                  {renderMiniatura(doc)}
                </div>

                <div className="document-meta">
                  <strong>{doc.tipo}</strong>
                  <span>Orden {doc.orden || "-"}</span>
                  {doc.contexto && <p>{doc.contexto}</p>}
                  {doc.url && (
                    <a href={doc.url} download={`documento-${doc.documentoId}.${doc.extension}`}>
                      Descargar
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
