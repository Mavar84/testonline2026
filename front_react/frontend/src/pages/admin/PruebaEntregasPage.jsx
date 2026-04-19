import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import api from "../../services/api"
import AdminPageHeader from "../../components/AdminPageHeader"

function formatearFecha(valor) {
  if (!valor) return "-"
  return new Date(valor).toLocaleString()
}

function construirDataUriImagen(base64) {
  if (!base64) return ""
  if (base64.startsWith("data:")) return base64
  return `data:image/jpeg;base64,${base64}`
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

export default function PruebaEntregasPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [resumen, setResumen] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [intentoActivo, setIntentoActivo] = useState(null)
  const [cargandoLista, setCargandoLista] = useState(true)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [enviandoCorreo, setEnviandoCorreo] = useState(false)

  useEffect(() => {
    cargarEntregas()
  }, [id])

  const cargarEntregas = async () => {
    setCargandoLista(true)
    try {
      const res = await api.get(`/respuestas/profesor/pruebas/${id}/entregas/`)
      setResumen(res.data)
    } catch (error) {
      console.error(error.response?.data || error)
      alert("No se pudo cargar la lista de entregas.")
    } finally {
      setCargandoLista(false)
    }
  }

  const cargarDetalle = async (intentoId) => {
    setCargandoDetalle(true)
    try {
      const res = await api.get(`/respuestas/profesor/pruebas/${id}/entregas/${intentoId}/`)
      setDetalle(res.data)
      setIntentoActivo(intentoId)
    } catch (error) {
      console.error(error.response?.data || error)
      alert("No se pudo cargar el detalle de la entrega.")
    } finally {
      setCargandoDetalle(false)
    }
  }

  const autoevaluar = async () => {
    if (!intentoActivo) return
    setGuardando(true)
    try {
      const res = await api.post(`/respuestas/profesor/pruebas/${id}/entregas/${intentoActivo}/autoevaluar/`)
      setDetalle(res.data)
      await cargarEntregas()
    } catch (error) {
      console.error(error.response?.data || error)
      alert(error.response?.data?.detail || "No se pudo ejecutar la evaluación automática.")
    } finally {
      setGuardando(false)
    }
  }

  const actualizarPuntaje = (tipo, itemId, valor) => {
    setDetalle((prev) => ({
      ...prev,
      items: prev.items.map((item) => (
        item.tipo === tipo && item.item_id === itemId
          ? { ...item, puntaje_ganado: valor }
          : item
      ))
    }))
  }

  const actualizarComentario = (tipo, itemId, valor) => {
    setDetalle((prev) => ({
      ...prev,
      items: prev.items.map((item) => (
        item.tipo === tipo && item.item_id === itemId
          ? { ...item, comentario_profesor: valor }
          : item
      ))
    }))
  }

  const guardarEvaluacion = async () => {
    if (!detalle || !intentoActivo) return
    setGuardando(true)
    try {
      const payload = detalle.items
        .filter((item) => ["abierta", "identificacion", "pareo"].includes(item.tipo))
        .map((item) => ({
          tipo: item.tipo,
          item_id: item.item_id,
          puntaje_ganado: item.puntaje_ganado || 0,
          comentario_profesor: item.comentario_profesor || ""
        }))

      const res = await api.post(`/respuestas/profesor/pruebas/${id}/entregas/${intentoActivo}/guardar-evaluacion/`, {
        items: payload
      })
      setDetalle(res.data)
      await cargarEntregas()
      alert("Evaluación guardada.")
    } catch (error) {
      console.error(error.response?.data || error)
      alert(error.response?.data?.detail || "No se pudo guardar la evaluación.")
    } finally {
      setGuardando(false)
    }
  }

  const enviarCalificacion = async () => {
    if (!intentoActivo) return
    setEnviandoCorreo(true)
    try {
      const res = await api.post(`/respuestas/profesor/pruebas/${id}/entregas/${intentoActivo}/enviar-calificacion/`)
      alert(res.data.detail || "Calificación enviada.")
      await cargarEntregas()
      await cargarDetalle(intentoActivo)
    } catch (error) {
      console.error(error.response?.data || error)
      alert(error.response?.data?.detail || "No se pudo enviar el correo de calificación.")
    } finally {
      setEnviandoCorreo(false)
    }
  }

  const entregas = resumen?.entregas || []
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
      <div className="container">
        <AdminPageHeader
          title="Entregas"
          subtitle="Revisa qué estudiantes ya presentaron esta prueba, abre sus respuestas y aplica una evaluación automática donde conviene."
        />

        <div className="card">
          <div className="assignment-header">
            <div>
              <h2>{resumen?.prueba?.asignatura || `Prueba #${id}`}</h2>
              <p>
                {resumen?.prueba?.nivel || "Nivel no indicado"} · {resumen?.prueba?.periodo || "Periodo no indicado"} · {resumen?.prueba?.centro_educativo || "Centro no indicado"}
              </p>
            </div>
            <div className="assignment-actions">
              <button type="button" className="btn-secondary" onClick={() => navigate("/admin/pruebas")}>
                Volver a pruebas
              </button>
            </div>
          </div>

          <div className="assignment-summary">
            <span>{entregas.length} entrega(s)</span>
            <span>Duración: {resumen?.prueba?.duracion_minutos || 60} min</span>
            <span>Aplicación: {formatearFecha(resumen?.prueba?.fecha_aplicacion)}</span>
          </div>

          <div className="review-layout">
            <section className="review-list-card">
              <h3>Entregas recibidas</h3>
              {cargandoLista && <p>Cargando entregas...</p>}
              {!cargandoLista && entregas.length === 0 && <p>Aún no hay exámenes entregados para esta prueba.</p>}

              <div className="review-submissions">
                {entregas.map((entrega) => (
                  <button
                    type="button"
                    key={entrega.intento_id}
                    className={`review-submission-item ${intentoActivo === entrega.intento_id ? "active" : ""}`}
                    onClick={() => cargarDetalle(entrega.intento_id)}
                  >
                    <div>
                      <strong>{entrega.estudiante_nombre}</strong>
                      <span>@{entrega.estudiante_username}</span>
                    </div>
                    <small>{formatearFecha(entrega.fecha_fin)}</small>
                    <div className="review-scoreline">
                      <span>{Number(entrega.puntaje_obtenido || 0).toFixed(2)} pts</span>
                      <span>{Number(entrega.porcentaje_obtenido || 0).toFixed(2)}%</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="review-detail-card">
              {!detalle && !cargandoDetalle && <p>Selecciona una entrega para revisar sus respuestas.</p>}
              {cargandoDetalle && <p>Cargando detalle...</p>}

              {detalle && !cargandoDetalle && (
                <>
                  <div className="review-detail-head">
                    <div className="review-student-head">
                      {detalle.estudiante.foto_estudiante ? (
                        <img
                          className="review-student-photo"
                          src={construirDataUriImagen(detalle.estudiante.foto_estudiante)}
                          alt={detalle.estudiante.nombre}
                        />
                      ) : (
                        <div className="review-student-photo placeholder">{detalle.estudiante.nombre?.[0] || "E"}</div>
                      )}
                      <div>
                        <h3>{detalle.estudiante.nombre}</h3>
                        <p>{detalle.estudiante.email || detalle.estudiante.username}</p>
                        <small>Entregado: {formatearFecha(detalle.intento.fecha_fin)}</small>
                      </div>
                    </div>

                    <div className="review-detail-actions">
                      <div className="review-score-summary">
                        <strong>{Number(detalle.intento.puntaje_obtenido || 0).toFixed(2)} pts</strong>
                        <span>{Number(detalle.intento.porcentaje_obtenido || 0).toFixed(2)}%</span>
                      </div>
                      <button type="button" className="btn-secondary" disabled={guardando} onClick={autoevaluar}>
                        Evaluar automático
                      </button>
                      <button type="button" className="btn-primary" disabled={guardando} onClick={guardarEvaluacion}>
                        Guardar evaluación
                      </button>
                      <button type="button" className="btn-success" disabled={enviandoCorreo} onClick={enviarCalificacion}>
                        {enviandoCorreo ? "Enviando..." : "Enviar calificación"}
                      </button>
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

                            {item.tipo === "seleccion" && (
                              <>
                                <div className="review-option-list">
                                  {item.opciones.map((opcion) => (
                                    <div
                                      key={opcion.indice}
                                      className={`review-option-row ${item.respuesta_estudiante === opcion.indice ? "selected" : ""} ${item.respuesta_correcta === opcion.indice ? "correct" : ""}`}
                                    >
                                      <span>{opcion.indice}</span>
                                      <p>{opcion.texto}</p>
                                    </div>
                                  ))}
                                </div>
                                <div className="review-score-edit">
                                  <span>Respuesta correcta: {item.respuesta_correcta}</span>
                                  <span>Puntaje automático: {Number(item.puntaje_ganado || 0).toFixed(2)} / {Number(item.puntaje_posible || 0).toFixed(2)}</span>
                                </div>
                                <div>
                                  <label>Comentario del profesor</label>
                                  <textarea
                                    rows="3"
                                    value={item.comentario_profesor || ""}
                                    onChange={(e) => actualizarComentario(item.tipo, item.item_id, e.target.value)}
                                  />
                                </div>
                              </>
                            )}

                            {item.tipo === "abierta" && (
                              <>
                                <div className="review-answer-columns">
                                  <div>
                                    <label>Respuesta del estudiante</label>
                                    <RespuestaValor valor={item.respuesta_estudiante} />
                                  </div>
                                  <div>
                                    <label>Respuestas esperadas</label>
                                    <RespuestaValor valor={item.respuesta_esperada} />
                                  </div>
                                </div>
                                <div className="review-score-edit">
                                  <span>Similitud sugerida: {Number(item.similitud_sugerida || 0).toFixed(2)}%</span>
                                  <span>Sugerido: {Number(item.puntaje_sugerido || 0).toFixed(2)} / {Number(item.puntaje_posible || 0).toFixed(2)}</span>
                                  <div>
                                    <label>Puntaje otorgado</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.25"
                                      max={item.puntaje_posible || 0}
                                      value={item.puntaje_ganado}
                                      onChange={(e) => actualizarPuntaje(item.tipo, item.item_id, e.target.value)}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label>Comentario del profesor</label>
                                  <textarea
                                    rows="3"
                                    value={item.comentario_profesor || ""}
                                    onChange={(e) => actualizarComentario(item.tipo, item.item_id, e.target.value)}
                                  />
                                </div>
                              </>
                            )}

                            {item.tipo === "pareo" && (
                              <>
                                <div className="review-answer-columns">
                                  <div>
                                    <label>Respuesta del estudiante</label>
                                    <RespuestaValor valor={item.respuesta_estudiante} />
                                  </div>
                                  <div>
                                    <label>Respuesta correcta</label>
                                    <RespuestaValor valor={item.respuesta_correcta} />
                                  </div>
                                </div>
                                <div className="review-score-edit">
                                  <span>Aciertos: {item.aciertos} / {item.total_relaciones}</span>
                                  <span>Sugerido: {Number(item.puntaje_sugerido || 0).toFixed(2)} / {Number(item.puntaje_posible || 0).toFixed(2)}</span>
                                  <div>
                                    <label>Puntaje otorgado</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.25"
                                      max={item.puntaje_posible || 0}
                                      value={item.puntaje_ganado}
                                      onChange={(e) => actualizarPuntaje(item.tipo, item.item_id, e.target.value)}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label>Comentario del profesor</label>
                                  <textarea
                                    rows="3"
                                    value={item.comentario_profesor || ""}
                                    onChange={(e) => actualizarComentario(item.tipo, item.item_id, e.target.value)}
                                  />
                                </div>
                              </>
                            )}

                            {item.tipo === "identificacion" && (
                              <>
                                <div className="review-answer-columns">
                                  <div>
                                    <label>Respuesta del estudiante</label>
                                    <RespuestaValor valor={item.respuesta_estudiante} />
                                  </div>
                                  <div>
                                    <label>Claves esperadas</label>
                                    <RespuestaValor valor={Object.fromEntries((item.componentes || []).map((componente) => [componente.id, componente.respuesta_correcta]))} />
                                  </div>
                                </div>
                                <div className="review-score-edit">
                                  <span>Calificación manual</span>
                                  <div>
                                    <label>Puntaje otorgado</label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.25"
                                      max={item.puntaje_posible || 0}
                                      value={item.puntaje_ganado}
                                      onChange={(e) => actualizarPuntaje(item.tipo, item.item_id, e.target.value)}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label>Comentario del profesor</label>
                                  <textarea
                                    rows="3"
                                    value={item.comentario_profesor || ""}
                                    onChange={(e) => actualizarComentario(item.tipo, item.item_id, e.target.value)}
                                  />
                                </div>
                              </>
                            )}
                          </article>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
