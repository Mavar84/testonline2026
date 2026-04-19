import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import api from "../../services/api"

function formatearFecha(valor) {
  if (!valor) return "-"
  return new Date(valor).toLocaleString()
}

function RespuestaValor({ valor }) {
  if (Array.isArray(valor)) {
    return <div className="review-answer-block">{valor.filter(Boolean).map((item, index) => <div key={index}>{item}</div>)}</div>
  }

  if (valor && typeof valor === "object") {
    return (
      <div className="review-answer-block">
        {Object.entries(valor).map(([clave, texto]) => (
          <div key={clave}><strong>{clave}:</strong> {texto || "(vacío)"}</div>
        ))}
      </div>
    )
  }

  return <span>{valor || "(sin respuesta)"}</span>
}

export default function StudentEntregaDetallePage() {
  const { intentoId } = useParams()
  const navigate = useNavigate()
  const [detalle, setDetalle] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarDetalle()
  }, [intentoId])

  const cargarDetalle = async () => {
    setCargando(true)
    try {
      const res = await api.get(`/respuestas/estudiante/entregas/${intentoId}/`)
      setDetalle(res.data)
    } catch (error) {
      console.error(error.response?.data || error)
      alert("No se pudo cargar la revisión del examen.")
    } finally {
      setCargando(false)
    }
  }

  const itemsAgrupados = useMemo(() => {
    const grupos = new Map()
    ;(detalle?.items || []).forEach((item) => {
      const clave = item.parte || item.tipo
      if (!grupos.has(clave)) grupos.set(clave, [])
      grupos.get(clave).push(item)
    })
    return Array.from(grupos.entries())
  }, [detalle])

  return (
    <div className="bg-gradient">
      <main className="student-shell">
        <section className="student-hero">
          <div>
            <span className="admin-kicker">Estudiante</span>
            <h1>Revisión del examen</h1>
            <p>Aquí puedes ver tu nota, tus respuestas y los comentarios que dejó el profesor.</p>
          </div>
          <div className="admin-page-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate("/estudiante/pruebas")}>
              Volver a mis pruebas
            </button>
          </div>
        </section>

        <section className="admin-section">
          {cargando && <p>Cargando revisión...</p>}

          {detalle && !cargando && (
            <div className="card">
              <div className="review-detail-head">
                <div>
                  <h2>{detalle.prueba.asignatura || `Prueba #${detalle.prueba.id}`}</h2>
                  <p>{detalle.prueba.nivel || "Nivel no indicado"} · {detalle.prueba.periodo || "Periodo no indicado"}</p>
                  <small>Entregado: {formatearFecha(detalle.intento.fecha_fin)}</small>
                </div>

                <div className="review-detail-actions">
                  <div className="review-score-summary">
                    <strong>{Number(detalle.intento.nota_obtenida || 0).toFixed(2)}</strong>
                    <span>{Number(detalle.intento.porcentaje_obtenido || 0).toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              {itemsAgrupados.map(([parte, items]) => (
                <div className="review-part-block" key={parte}>
                  <h4>{parte}</h4>
                  <div className="review-item-list">
                    {items.map((item) => (
                      <article className="review-item-card" key={`${item.tipo}-${item.item_id}`}>
                        <div className="review-item-top">
                          <span className="review-item-order">#{item.orden}</span>
                          <strong>{item.enunciado}</strong>
                        </div>

                        <div className="review-answer-columns">
                          <div>
                            <label>Tu respuesta</label>
                            <RespuestaValor valor={item.respuesta_estudiante} />
                          </div>
                          <div>
                            <label>Retroalimentación</label>
                            <div className="review-answer-block">
                              <div><strong>Puntaje:</strong> {Number(item.puntaje_ganado || 0).toFixed(2)} / {Number(item.puntaje_posible || 0).toFixed(2)}</div>
                              <div><strong>Comentario:</strong> {item.comentario_profesor || "Sin comentario del profesor."}</div>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
