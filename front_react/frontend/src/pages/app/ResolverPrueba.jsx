import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import api from "../../services/api"
import ExamEntryVerifier from "../../components/ExamEntryVerifier"
import {
  eliminarSesionExamen,
  guardarSesionExamen,
  obtenerSesionExamen,
} from "../../services/examCache"

const tipoParteLabel = {
  seleccion: "Selección única",
  abierta: "Respuesta única",
  identificacion: "Identificación",
  pareo: "Pareo"
}

function construirDataUri(tipo, contenido) {
  if (!contenido) return ""
  if (contenido.startsWith("data:")) return contenido

  if (tipo === 1) return `data:image/png;base64,${contenido}`
  if (tipo === 2) return `data:application/pdf;base64,${contenido}`
  if (tipo === 3) return `data:video/mp4;base64,${contenido}`
  if (tipo === 4) return `data:audio/mpeg;base64,${contenido}`
  return contenido
}

function obtenerEtiquetaDocumento(tipo) {
  if (tipo === 1) return "Imagen"
  if (tipo === 2) return "PDF"
  if (tipo === 3) return "Video"
  if (tipo === 4) return "Audio"
  return "Archivo"
}

function obtenerMimeDocumento(tipo) {
  if (tipo === 1) return "image/png"
  if (tipo === 2) return "application/pdf"
  if (tipo === 3) return "video/mp4"
  if (tipo === 4) return "audio/mpeg"
  return "application/octet-stream"
}

function dataUriABlob(src, mimeFallback) {
  if (!src) return null

  if (src.startsWith("data:")) {
    const [header, base64] = src.split(",")
    const mime = header.match(/data:(.*?);base64/)?.[1] || mimeFallback
    const bytes = window.atob(base64)
    const len = bytes.length
    const buffer = new Uint8Array(len)
    for (let i = 0; i < len; i += 1) buffer[i] = bytes.charCodeAt(i)
    return new Blob([buffer], { type: mime })
  }

  return new Blob([src], { type: mimeFallback })
}

function crearRespuestaInicial(item) {
  if (item.tipo === "seleccion") return 0
  if (item.tipo === "abierta") return Array.from({ length: item.cantidad_respuestas || 1 }, () => "")
  if (item.tipo === "identificacion") {
    return Object.fromEntries((item.componentes || []).map((componente) => [String(componente.id), ""]))
  }
  if (item.tipo === "pareo") {
    return Object.fromEntries((item.izquierda || []).map((lado) => [String(lado.id), ""]))
  }
  return ""
}

function barajar(array) {
  const copia = [...array]
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

function tieneContenidoRespuesta(respuesta) {
  if (Array.isArray(respuesta)) return respuesta.some((valor) => `${valor}`.trim())
  if (typeof respuesta === "object" && respuesta !== null) return Object.values(respuesta).some((valor) => `${valor}`.trim())
  return !!respuesta
}

async function sha256Hex(payload) {
  const data = new TextEncoder().encode(stableStringify(payload))
  const digest = await window.crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`
  }

  return JSON.stringify(value)
}

function normalizarRespuestaParaHash(tipo, valor) {
  if (tipo === "seleccion") return Number(valor || 0)
  if (tipo === "abierta") {
    if (Array.isArray(valor)) return valor.map((item) => `${item}`)
    if (valor === null || valor === undefined || valor === "") return []
    return [`${valor}`]
  }
  if (tipo === "identificacion" || tipo === "pareo") {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {}
    return Object.fromEntries(
      Object.entries(valor)
        .map(([clave, texto]) => [String(clave), texto === null || texto === undefined ? "" : String(texto)])
        .sort(([a], [b]) => a.localeCompare(b))
    )
  }
  return valor
}

export default function ResolverPrueba() {
  const { id } = useParams()
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [offline, setOffline] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [segundosRestantes, setSegundosRestantes] = useState(0)
  const [examAccessToken, setExamAccessToken] = useState("")
  const [accesoValidado, setAccesoValidado] = useState(false)

  useEffect(() => {
    setSesion(null)
    setError("")
    setOffline(false)
    setAccesoValidado(false)
    setExamAccessToken("")
  }, [id])

  useEffect(() => {
    if (!sesion?.progreso?.finLocal) return undefined

    const actualizar = () => {
      setSegundosRestantes(Math.max(0, Math.floor((sesion.progreso.finLocal - Date.now()) / 1000)))
    }

    actualizar()
    const timer = window.setInterval(actualizar, 1000)
    return () => window.clearInterval(timer)
  }, [sesion?.progreso?.finLocal])

  useEffect(() => {
    if (!sesion) return
    guardarSesionExamen(sesion).catch((cacheError) => console.error(cacheError))
  }, [sesion])

  const cargarPrueba = async (tokenOverride = null) => {
    setCargando(true)
    setError("")

    const cacheActual = await obtenerSesionExamen(id)

    try {
      const res = await api.get(`/pruebas/pruebas/${id}/completa/`, {
        headers: {
          "X-Exam-Access": tokenOverride || examAccessToken
        }
      })
      const payload = res.data
      const fechaLimiteServidor = new Date(payload.intento.fecha_limite_servidor).getTime()
      const progreso = cacheActual?.progreso || {
        currentItemIndex: 0,
        respuestas: {},
        anotaciones: {},
        pareoOrden: {},
        inicioLocal: Date.now(),
        finLocal: fechaLimiteServidor,
        enviado: false
      }

      const respuestas = { ...progreso.respuestas }
      const anotaciones = { ...progreso.anotaciones }
      const pareoOrden = { ...progreso.pareoOrden }

      payload.items.forEach((item) => {
        const key = `${item.tipo}-${item.id}`
        if (respuestas[key] === undefined) respuestas[key] = crearRespuestaInicial(item)
        if (anotaciones[key] === undefined) anotaciones[key] = ""
        if (item.tipo === "pareo" && !pareoOrden[item.id]) {
          pareoOrden[item.id] = barajar(item.derecha || []).map((opcion) => opcion.id)
        }
      })

      setSesion({
        pruebaId: String(id),
        payload,
        progreso: {
          ...progreso,
          respuestas,
          anotaciones,
          pareoOrden,
          finLocal: fechaLimiteServidor,
          intentoId: payload.intento.id
        }
      })
      setOffline(false)
    } catch (fetchError) {
      console.error(fetchError.response?.data || fetchError)
      if (cacheActual) {
        setSesion(cacheActual)
        setOffline(true)
      } else {
        setError("No se pudo cargar la prueba ni existe una copia local disponible.")
      }
    } finally {
      setCargando(false)
    }
  }

  const payload = sesion?.payload
  const items = payload?.items || []
  const progreso = sesion?.progreso
  const currentItemIndex = progreso?.currentItemIndex || 0
  const currentItem = items[currentItemIndex]
  const partes = useMemo(() => payload?.partes || [], [payload])
  const currentItemKey = currentItem ? `${currentItem.tipo}-${currentItem.id}` : ""
  const parteActual = partes.find((parte) => (parte.item_keys || []).includes(currentItemKey))

  const actualizarSesion = (updater) => {
    setSesion((prev) => (prev ? updater(prev) : prev))
  }

  const cambiarItem = (index) => {
    actualizarSesion((prev) => ({
      ...prev,
      progreso: {
        ...prev.progreso,
        currentItemIndex: Math.max(0, Math.min(index, prev.payload.items.length - 1))
      }
    }))
  }

  const actualizarRespuesta = (item, value) => {
    const key = `${item.tipo}-${item.id}`
    actualizarSesion((prev) => ({
      ...prev,
      progreso: {
        ...prev.progreso,
        respuestas: {
          ...prev.progreso.respuestas,
          [key]: value
        }
      }
    }))
  }

  const actualizarAnotacion = (item, value) => {
    const key = `${item.tipo}-${item.id}`
    actualizarSesion((prev) => ({
      ...prev,
      progreso: {
        ...prev.progreso,
        anotaciones: {
          ...prev.progreso.anotaciones,
          [key]: value
        }
      }
    }))
  }

  const respuestaActual = currentItem ? progreso?.respuestas?.[`${currentItem.tipo}-${currentItem.id}`] : null
  const anotacionActual = currentItem ? progreso?.anotaciones?.[`${currentItem.tipo}-${currentItem.id}`] : ""

  const formatearTiempo = (totalSegundos) => {
    const horas = String(Math.floor(totalSegundos / 3600)).padStart(2, "0")
    const minutos = String(Math.floor((totalSegundos % 3600) / 60)).padStart(2, "0")
    const segundos = String(totalSegundos % 60).padStart(2, "0")
    return `${horas}:${minutos}:${segundos}`
  }

  const entregar = async () => {
    if (!sesion) return

    setEnviando(true)
    setError("")
    try {
      const respuestas = sesion.payload.items.map((item) => ({
        tipo: item.tipo,
        item_id: item.id,
        puntaje: item.puntaje,
        respuesta: sesion.progreso.respuestas[`${item.tipo}-${item.id}`]
      }))

      const pendientes = sesion.payload.items.filter((item) => {
        const respuesta = sesion.progreso.respuestas[`${item.tipo}-${item.id}`]
        return !tieneContenidoRespuesta(respuesta)
      })

      const mensajeConfirmacion = pendientes.length
        ? `Todavía hay ${pendientes.length} pregunta(s) sin responder (${pendientes.map((item) => item.orden).join(", ")}).\n\nSi aceptas, el examen se enviará igualmente.`
        : "Se enviará tu examen con las respuestas actuales. ¿Deseas continuar?"

      if (!window.confirm(mensajeConfirmacion)) {
        setEnviando(false)
        return
      }

      const sobre = {
        prueba_id: payload.prueba.id,
        intento_id: sesion.progreso.intentoId,
        respuestas: respuestas.map((respuesta) => ({
          tipo: respuesta.tipo,
          item_id: Number(respuesta.item_id),
          puntaje: String(respuesta.puntaje ?? 1),
          respuesta: normalizarRespuestaParaHash(respuesta.tipo, respuesta.respuesta)
        })).sort((a, b) => {
          const claveA = `${a.tipo}-${a.item_id}`
          const claveB = `${b.tipo}-${b.item_id}`
          return claveA.localeCompare(claveB)
        })
      }
      const hashEntrega = await sha256Hex(sobre)

      const res = await api.post("/respuestas/entregar-intento/", {
        prueba_id: payload.prueba.id,
        intento_id: sesion.progreso.intentoId,
        respuestas,
        finalizado_en: new Date().toISOString(),
        hash_entrega: hashEntrega
      })

      await eliminarSesionExamen(id)
      const mensajeCorreo = res.data.correo_confirmacion_enviado
        ? "\nCorreo de verificación enviado."
        : (res.data.correo_confirmacion_error ? `\n${res.data.correo_confirmacion_error}` : "")
      alert(`Prueba enviada correctamente.${mensajeCorreo}`)
      window.location.href = "/estudiante/pruebas"
    } catch (submitError) {
      console.error(submitError.response?.data || submitError)
      const data = submitError.response?.data
      if (submitError.response?.status === 409) {
        setError(data?.detail || "No se pudo verificar la integridad del envío. Intenta enviarlo nuevamente.")
      } else if (submitError.response?.status === 400 && data?.faltantes?.length) {
        setError(`Faltaron respuestas para los ítems ${data.faltantes.join(", ")}. Revisa el examen y vuelve a enviarlo.`)
      } else {
        setError(data?.detail || "No se pudo enviar la prueba. Tus respuestas siguen guardadas localmente.")
      }
    } finally {
      setEnviando(false)
    }
  }

  const abrirDocumentoEnPestana = (documento) => {
    const src = construirDataUri(documento.tipo, documento.contenido)
    const titulo = documento.contexto || documento.descripcion || obtenerEtiquetaDocumento(documento.tipo)
    const blob = dataUriABlob(src, obtenerMimeDocumento(documento.tipo))
    if (!blob) return

    const objectUrl = URL.createObjectURL(blob)

    if (documento.tipo === 2) {
      window.open(objectUrl, "_blank")
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
      return
    }

    const media = documento.tipo === 1
      ? `<img src="${objectUrl}" alt="${titulo}" style="max-width:100%;height:auto;display:block;margin:0 auto;" />`
      : documento.tipo === 3
        ? `<video src="${objectUrl}" controls autoplay style="width:min(1100px,100%);max-height:88vh;display:block;margin:0 auto;background:#000;border-radius:12px;"></video>`
        : documento.tipo === 4
          ? `<div style="display:grid;place-items:center;height:70vh;"><audio src="${objectUrl}" controls autoplay style="width:min(720px,90vw);"></audio></div>`
          : `<a href="${objectUrl}" target="_self">Abrir archivo</a>`

    const viewerHtml = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>${titulo}</title>
          <style>
            body { margin: 0; font-family: Segoe UI, sans-serif; background: #0f172a; color: #fff; }
            header { padding: 14px 18px; background: #111827; border-bottom: 1px solid rgba(255,255,255,.12); }
            main { padding: 16px; }
          </style>
        </head>
        <body>
          <header>${titulo}</header>
          <main>${media}</main>
        </body>
      </html>
    `

    const viewerBlob = new Blob([viewerHtml], { type: "text/html" })
    const viewerUrl = URL.createObjectURL(viewerBlob)
    window.open(viewerUrl, "_blank")

    window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl)
      URL.revokeObjectURL(viewerUrl)
    }, 60000)
  }

  const renderDocumentos = (documentos) => {
    if (!documentos?.length) return null
    return (
      <div className="exam-documents">
        {documentos.map((documento) => {
          const src = construirDataUri(documento.tipo, documento.contenido)
          const etiqueta = obtenerEtiquetaDocumento(documento.tipo)
          return (
            <button
              type="button"
              className="exam-document-card"
              key={documento.id}
              onClick={() => abrirDocumentoEnPestana(documento)}
            >
              <div className="exam-document-preview">
                {documento.tipo === 1 ? (
                  <img src={src} alt={documento.descripcion || "Documento"} />
                ) : (
                  <div className={`exam-document-placeholder tipo-${documento.tipo}`}>
                    <strong>{etiqueta}</strong>
                  </div>
                )}
              </div>
              <div className="exam-document-meta">
                <small>{etiqueta}</small>
                <span>{documento.contexto || documento.descripcion || "Adjunto del ítem"}</span>
                <b>Abrir</b>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  const renderItemActual = () => {
    if (!currentItem) return null

    if (currentItem.tipo === "seleccion") {
      return (
        <div className="exam-answer-block">
          {currentItem.opciones.map((opcion, index) => {
            const seleccionada = Number(respuestaActual) === opcion.indice
            const letra = String.fromCharCode(65 + index)
            return (
              <label className={`exam-option ${seleccionada ? "selected" : ""}`} key={opcion.indice}>
                <input
                  type="radio"
                  checked={seleccionada}
                  onChange={() => actualizarRespuesta(currentItem, opcion.indice)}
                />
                <span className="exam-option-marker">{letra}</span>
                <span className="exam-option-text">{opcion.texto}</span>
              </label>
            )
          })}
        </div>
      )
    }

    if (currentItem.tipo === "abierta") {
      const respuestas = Array.isArray(respuestaActual) ? respuestaActual : [""]
      return (
        <div className="exam-answer-block">
          {respuestas.map((valor, index) => (
            <div key={`respuesta-${index}`}>
              <label>Respuesta {index + 1}</label>
              <input
                value={valor}
                onChange={(e) => {
                  const siguientes = [...respuestas]
                  siguientes[index] = e.target.value
                  actualizarRespuesta(currentItem, siguientes)
                }}
              />
            </div>
          ))}
          <button type="button" className="btn-secondary" onClick={() => actualizarRespuesta(currentItem, [...respuestas, ""])}>
            Agregar respuesta
          </button>
        </div>
      )
    }

    if (currentItem.tipo === "identificacion") {
      return (
        <div className="exam-identification-layout">
          <div className="exam-identification-stage">
            {currentItem.imagen ? <img src={currentItem.imagen} alt="Base de identificación" /> : null}
            {(currentItem.componentes || []).map((componente) => (
              <button
                type="button"
                className="identification-pin exam-pin"
                key={componente.id}
                style={{ left: `${componente.x}%`, top: `${componente.y}%` }}
              >
                {componente.numero}
              </button>
            ))}
          </div>
          <div className="exam-identification-answers">
            {(currentItem.componentes || []).map((componente) => (
              <div key={componente.id}>
                <label>Punto {componente.numero}</label>
                <input
                  value={respuestaActual?.[String(componente.id)] || ""}
                  onChange={(e) => actualizarRespuesta(currentItem, {
                    ...(respuestaActual || {}),
                    [String(componente.id)]: e.target.value
                  })}
                />
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (currentItem.tipo === "pareo") {
      const ordenDerecha = progreso?.pareoOrden?.[currentItem.id] || []
      const opcionesDerecha = ordenDerecha
        .map((rightId) => (currentItem.derecha || []).find((item) => item.id === rightId))
        .filter(Boolean)

      return (
        <div className="exam-answer-block">
          {(currentItem.izquierda || []).map((lado) => (
            <div className="exam-pareo-row" key={lado.id}>
              <div className="exam-pareo-left">
                <strong>{lado.numero}.</strong> {lado.texto}
              </div>
              <select
                value={respuestaActual?.[String(lado.id)] || ""}
                onChange={(e) => actualizarRespuesta(currentItem, {
                  ...(respuestaActual || {}),
                  [String(lado.id)]: e.target.value
                })}
              >
                <option value="">Seleccione una opción</option>
                {opcionesDerecha.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>{opcion.texto}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )
    }

    return null
  }

  if (!accesoValidado) {
    return (
      <div className="bg-gradient center">
        <div className="card auth-card" style={{ width: "min(760px, calc(100% - 24px))" }}>
          <ExamEntryVerifier
            pruebaId={id}
            onSuccess={(data) => {
              setExamAccessToken(data.exam_access_token)
              setAccesoValidado(true)
              cargarPrueba(data.exam_access_token)
            }}
            onCancel={() => {
              window.location.href = "/estudiante/pruebas"
            }}
          />
        </div>
      </div>
    )
  }

  if (cargando) return <div className="bg-gradient center"><div className="card"><p>Cargando prueba...</p></div></div>
  if (error && !sesion) return <div className="bg-gradient center"><div className="card"><p>{error}</p></div></div>

  return (
    <div className="bg-gradient">
      <main className="exam-shell">
        <aside className="exam-sidebar">
          <div className="card exam-sidecard">
            <span className="admin-kicker">Resolución</span>
            <h2>{payload.prueba.asignatura || "Prueba"}</h2>
            <p>{payload.prueba.nivel || "Nivel no indicado"} | {payload.prueba.periodo || "Periodo no indicado"}</p>
            {offline && <p className="exam-offline-banner">Trabajando desde la copia local. Tus respuestas siguen guardadas aquí.</p>}

            <div className="exam-parts-list">
              {partes.map((parte) => (
                <button
                  type="button"
                  key={parte.id}
                  className={parte.id === parteActual?.id ? "exam-part-button active" : "exam-part-button"}
                  onClick={() => {
                    const primerItemKey = parte.item_keys?.[0]
                    const index = items.findIndex((item) => `${item.tipo}-${item.id}` === primerItemKey)
                    cambiarItem(index)
                  }}
                >
                  <strong>{parte.titulo}</strong>
                  <small>{parte.item_keys?.length || 0} ítems</small>
                </button>
              ))}
            </div>

            <div className="exam-item-grid">
              {items.map((item, index) => {
                const key = `${item.tipo}-${item.id}`
                const respondido = progreso?.respuestas?.[key]
                return (
                  <button
                    type="button"
                    key={key}
                    className={index === currentItemIndex ? "exam-item-pill active" : "exam-item-pill"}
                    onClick={() => cambiarItem(index)}
                  >
                    {item.orden}
                    {tieneContenidoRespuesta(respondido) ? " ✓" : ""}
                  </button>
                )
              })}
            </div>
          </div>
        </aside>

        <section className="exam-main">
          <div className="card exam-card">
            <div className="exam-topbar">
              <div>
                <span className="admin-kicker">{tipoParteLabel[currentItem?.tipo] || "Ítem"}</span>
                <h2>{payload.prueba.asignatura}</h2>
              </div>

              <div className="exam-student-chip">
                {payload.estudiante?.foto_estudiante ? (
                  <img src={payload.estudiante.foto_estudiante} alt={payload.estudiante.nombre} />
                ) : (
                  <div className="exam-student-fallback">{(payload.estudiante?.nombre || "E").slice(0, 1)}</div>
                )}
                <div>
                  <strong>{payload.estudiante?.nombre || payload.estudiante?.username}</strong>
                  <small>Tiempo restante: {formatearTiempo(segundosRestantes)}</small>
                </div>
              </div>
            </div>

            {error && <p className="auth-error">{error}</p>}

            {currentItem && (
              <>
                <div className="exam-question-head">
                  <div>
                    <span className="exam-order">Ítem {currentItem.orden}</span>
                    <h3>{currentItem.enunciado}</h3>
                  </div>
                  <span className="exam-points">{currentItem.puntaje} pts</span>
                </div>

                {currentItem.imagen && (
                  <div className="exam-main-image">
                    <img src={currentItem.imagen} alt={`Item ${currentItem.orden}`} />
                  </div>
                )}

                {renderDocumentos(currentItem.documentos)}
                {renderItemActual()}

                <div className="exam-note-block">
                  <label>Anotaciones personales</label>
                  <textarea
                    value={anotacionActual || ""}
                    onChange={(e) => actualizarAnotacion(currentItem, e.target.value)}
                    placeholder="Estas anotaciones se guardan solo en este navegador."
                  />
                </div>

                <div className="exam-nav">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={currentItemIndex === 0}
                    onClick={() => cambiarItem(currentItemIndex - 1)}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={currentItemIndex === items.length - 1}
                    onClick={() => cambiarItem(currentItemIndex + 1)}
                  >
                    Siguiente
                  </button>
                  <button type="button" className="btn-primary" disabled={enviando} onClick={entregar}>
                    {enviando ? "Enviando..." : "Finalizar y enviar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
