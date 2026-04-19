import { useEffect, useMemo, useState } from "react"
import api from "../../services/api"
import DocumentoUploader from "../../components/DocumentoUploader"
import AdminPageHeader from "../../components/AdminPageHeader"
import TextTools from "../../components/TextTools"
import SpellingTools from "../../components/SpellingTools"
import { fileToBase64Limpio, mimePorTipo, tipoNumeroPorClave } from "../../services/documentos"

const filaVacia = () => ({
  tempId: crypto.randomUUID(),
  izquierda: "",
  derecha: ""
})

const estadoInicial = {
  id: null,
  enunciado: "",
  resultado: "",
  pares: [filaVacia()]
}

const abrirDB = () => new Promise((resolve, reject) => {
  const request = indexedDB.open("documentosDB", 5)
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const obtenerDocumentosDB = async () => {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction("documentos", "readonly")
    const store = tx.objectStore("documentos")
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export default function ItemPareoPage() {
  const [tab, setTab] = useState(0)
  const [formulario, setFormulario] = useState(estadoInicial)
  const [resultados, setResultados] = useState([])
  const [items, setItems] = useState([])
  const [itemExpandido, setItemExpandido] = useState(null)
  const [idiomaOrtografia, setIdiomaOrtografia] = useState("es")

  const propsOrtografia = {
    spellCheck: true,
    lang: idiomaOrtografia === "auto" ? undefined : idiomaOrtografia
  }

  useEffect(() => {
    cargarResultados()
    cargarItems()
  }, [])

  const cargarResultados = async () => {
    const res = await api.get("/core/resultados/")
    setResultados(res.data)
  }

  const cargarItems = async () => {
    const [encabezadosRes, detallesRes, relacionesRes] = await Promise.all([
      api.get("/items/pareo/"),
      api.get("/items/pareo-detalles/"),
      api.get("/items/pareo-relaciones/")
    ])

    const completos = encabezadosRes.data.map((item) => {
      const detalles = detallesRes.data.filter((detalle) => detalle.encabezado === item.id)
      const detallesPorId = Object.fromEntries(detalles.map((detalle) => [detalle.id, detalle]))
      const relaciones = relacionesRes.data.filter(
        (relacion) => detallesPorId[relacion.item_izquierda] && detallesPorId[relacion.item_derecha]
      )

      const pares = relaciones.map((relacion, index) => ({
        id: relacion.id,
        izquierdaId: relacion.item_izquierda,
        derechaId: relacion.item_derecha,
        izquierda: detallesPorId[relacion.item_izquierda]?.texto || "",
        derecha: detallesPorId[relacion.item_derecha]?.texto || "",
        orden: index + 1
      }))

      return { ...item, detalles, relaciones, pares }
    })

    setItems(completos)
  }

  const limpiarFormulario = () => {
    setFormulario(estadoInicial)
    setTab(0)
  }

  const actualizarCampo = (name, value) => {
    setFormulario((prev) => ({ ...prev, [name]: value }))
  }

  const actualizarPar = (tempId, lado, value) => {
    setFormulario((prev) => ({
      ...prev,
      pares: prev.pares.map((par) => (
        par.tempId === tempId ? { ...par, [lado]: value } : par
      ))
    }))
  }

  const agregarPar = () => {
    setFormulario((prev) => ({ ...prev, pares: [...prev.pares, filaVacia()] }))
  }

  const eliminarPar = (tempId) => {
    setFormulario((prev) => {
      const siguientes = prev.pares.filter((par) => par.tempId !== tempId)
      return {
        ...prev,
        pares: siguientes.length ? siguientes : [filaVacia()]
      }
    })
  }

  const guardarDocumentosDesdeIndexedDB = async (itemId) => {
    const docsDB = await obtenerDocumentosDB()
    for (let i = 0; i < docsDB.length; i++) {
      const docLocal = docsDB[i]
      try {
        const contexto = window.prompt(`Ingrese el contexto para el documento ${i + 1} (${docLocal.tipo})`, "") || ""
        const base64 = await fileToBase64Limpio(docLocal.file)
        const tipoNumerico = tipoNumeroPorClave[docLocal.tipo] || 1

        const resDoc = await api.post("/items/documentos/", {
          contenido_base64: base64,
          tipo: tipoNumerico,
          descripcion: docLocal.tipo,
          hash: docLocal.hash,
          mime_type: docLocal.file?.type || mimePorTipo(tipoNumerico)
        })

        await api.post("/items/pareo-documentos/", {
          item: itemId,
          documento: resDoc.data.id,
          orden: i + 1,
          contexto
        })
      } catch (error) {
        console.error("Error procesando documento:", error.response?.data || error)
      }
    }
  }

  const guardarPares = async (itemId) => {
    const [detallesRes, relacionesRes] = await Promise.all([
      api.get("/items/pareo-detalles/"),
      api.get("/items/pareo-relaciones/")
    ])

    const detallesActuales = detallesRes.data.filter((detalle) => detalle.encabezado === itemId)
    const idsDetalles = new Set(detallesActuales.map((detalle) => detalle.id))
    const relacionesActuales = relacionesRes.data.filter(
      (relacion) => idsDetalles.has(relacion.item_izquierda) || idsDetalles.has(relacion.item_derecha)
    )

    await Promise.all(
      relacionesActuales.map((relacion) => api.delete(`/items/pareo-relaciones/${relacion.id}/`))
    )

    await Promise.all(
      detallesActuales.map((detalle) => api.delete(`/items/pareo-detalles/${detalle.id}/`))
    )

    const paresValidos = formulario.pares
      .map((par) => ({
        izquierda: par.izquierda.trim(),
        derecha: par.derecha.trim()
      }))
      .filter((par) => par.izquierda && par.derecha)

    for (const par of paresValidos) {
      const izquierdaRes = await api.post("/items/pareo-detalles/", {
        encabezado: itemId,
        texto: par.izquierda
      })

      const derechaRes = await api.post("/items/pareo-detalles/", {
        encabezado: itemId,
        texto: par.derecha
      })

      await api.post("/items/pareo-relaciones/", {
        item_izquierda: izquierdaRes.data.id,
        item_derecha: derechaRes.data.id
      })
    }
  }

  const guardar = async (e) => {
    e.preventDefault()
    const paresValidos = formulario.pares.filter((par) => par.izquierda.trim() && par.derecha.trim())

    if (!formulario.enunciado.trim() || paresValidos.length === 0) {
      alert("Complete el enunciado y al menos un pareo válido.")
      return
    }

    try {
      const payload = {
        enunciado: formulario.enunciado,
        resultado: formulario.resultado || null
      }

      let res
      if (formulario.id) {
        res = await api.put(`/items/pareo/${formulario.id}/`, payload)
        alert("Ítem actualizado")
      } else {
        res = await api.post("/items/pareo/", payload)
        alert("Ítem creado")
      }

      await guardarPares(res.data.id)
      await guardarDocumentosDesdeIndexedDB(res.data.id)

      limpiarFormulario()
      cargarItems()
    } catch (error) {
      console.error(error.response?.data || error)
      alert("Error guardando el ítem de pareo")
    }
  }

  const editarItem = (item) => {
    setFormulario({
      id: item.id,
      enunciado: item.enunciado || "",
      resultado: item.resultado || "",
      pares: item.pares?.length
        ? item.pares.map((par) => ({
            tempId: crypto.randomUUID(),
            izquierda: par.izquierda,
            derecha: par.derecha
          }))
        : [filaVacia()]
    })
    setTab(0)
  }

  const eliminarItem = async (id) => {
    if (!window.confirm("¿Desea eliminar este ítem de pareo?")) return
    await api.delete(`/items/pareo/${id}/`)
    cargarItems()
  }

  const verDocumentos = (id) => {
    window.open(`/admin/items-pareo/${id}/documentos`, "_blank", "noopener,noreferrer")
  }

  const resumenPares = useMemo(
    () => formulario.pares.filter((par) => par.izquierda.trim() && par.derecha.trim()).length,
    [formulario.pares]
  )

  const catalogoIzquierda = useMemo(
    () => [...new Set(items.flatMap((item) => item.pares?.map((par) => par.izquierda?.trim()).filter(Boolean) || []))],
    [items]
  )

  const catalogoDerecha = useMemo(
    () => [...new Set(items.flatMap((item) => item.pares?.map((par) => par.derecha?.trim()).filter(Boolean) || []))],
    [items]
  )

  return (
    <div className="bg-gradient">
      <div className="container">
        <AdminPageHeader
          title="Ítems de Pareo"
          subtitle="Define el encabezado y crea pares correctos entre elementos de la izquierda y de la derecha."
        />

        <div className="card">
          <h2>Ítem de Pareo</h2>

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button type="button" className={tab === 0 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(0)}>General</button>
            <button type="button" className={tab === 1 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(1)}>Pares</button>
            <button type="button" className={tab === 2 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(2)}>Documentos</button>
          </div>

          <form onSubmit={guardar}>
            {tab === 0 && (
              <>
                <label>Resultado</label>
                <select value={formulario.resultado} onChange={(e) => actualizarCampo("resultado", e.target.value)}>
                  <option value="">Seleccione</option>
                  {resultados.map((r) => (
                    <option key={r.id} value={r.id}>{r.texto}</option>
                  ))}
                </select>

                <label>Encabezado / enunciado</label>
                <textarea
                  value={formulario.enunciado}
                  onChange={(e) => actualizarCampo("enunciado", e.target.value)}
                  {...propsOrtografia}
                />
                <TextTools
                  value={formulario.enunciado}
                  onChange={(value) => actualizarCampo("enunciado", value)}
                  onInsert={(texto) => actualizarCampo("enunciado", `${formulario.enunciado}${texto}`)}
                />
                <SpellingTools language={idiomaOrtografia} onLanguageChange={setIdiomaOrtografia} />
              </>
            )}

            {tab === 1 && (
              <>
                <div className="pareo-toolbar">
                  <span>{resumenPares} pareo(s) completos</span>
                  <button type="button" className="btn-success" onClick={agregarPar}>Agregar fila</button>
                </div>

                <div className="pareo-list">
                  {formulario.pares.map((par, index) => (
                    <div className="pareo-row" key={par.tempId}>
                      <div className="pareo-side">
                        <label>Ítem izquierdo {index + 1}</label>
                        <textarea
                          value={par.izquierda}
                          onChange={(e) => actualizarPar(par.tempId, "izquierda", e.target.value)}
                          {...propsOrtografia}
                        />
                        <label>Elegir ítem guardado</label>
                        <select
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return
                            actualizarPar(par.tempId, "izquierda", e.target.value)
                            e.target.value = ""
                          }}
                        >
                          <option value="">Seleccionar...</option>
                          {catalogoIzquierda.map((opcion) => (
                            <option key={`izq-${opcion}`} value={opcion}>
                              {opcion.length > 90 ? `${opcion.substring(0, 90)}...` : opcion}
                            </option>
                          ))}
                        </select>
                        <TextTools
                          value={par.izquierda}
                          onChange={(value) => actualizarPar(par.tempId, "izquierda", value)}
                          onInsert={(texto) => actualizarPar(par.tempId, "izquierda", `${par.izquierda}${texto}`)}
                        />
                      </div>

                      <div className="pareo-arrow">↔</div>

                      <div className="pareo-side">
                        <label>Respuesta correcta {index + 1}</label>
                        <textarea
                          value={par.derecha}
                          onChange={(e) => actualizarPar(par.tempId, "derecha", e.target.value)}
                          {...propsOrtografia}
                        />
                        <label>Elegir respuesta guardada</label>
                        <select
                          value=""
                          onChange={(e) => {
                            if (!e.target.value) return
                            actualizarPar(par.tempId, "derecha", e.target.value)
                            e.target.value = ""
                          }}
                        >
                          <option value="">Seleccionar...</option>
                          {catalogoDerecha.map((opcion) => (
                            <option key={`der-${opcion}`} value={opcion}>
                              {opcion.length > 90 ? `${opcion.substring(0, 90)}...` : opcion}
                            </option>
                          ))}
                        </select>
                        <TextTools
                          value={par.derecha}
                          onChange={(value) => actualizarPar(par.tempId, "derecha", value)}
                          onInsert={(texto) => actualizarPar(par.tempId, "derecha", `${par.derecha}${texto}`)}
                        />
                      </div>

                      <button type="button" className="btn-danger pareo-remove" onClick={() => eliminarPar(par.tempId)}>
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === 2 && <DocumentoUploader onDocumentoAgregado={() => {}} />}

            <div className="mt-2">
              <button className="btn-primary">
                {formulario.id ? "Actualizar ítem" : "Guardar ítem"}
              </button>
            </div>
          </form>
        </div>

        <div className="card mt-3">
          <h3>Listado de ítems de pareo</h3>

          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Encabezado</th>
                <th>Pares</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.enunciado?.substring(0, 80)}...</td>
                  <td>{item.pares?.length || 0}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn-primary" onClick={() => setItemExpandido(itemExpandido === item.id ? null : item.id)}>Detalle</button>
                    <button type="button" className="btn-secondary" onClick={() => editarItem(item)}>Editar</button>
                    <button type="button" className="btn-success" onClick={() => verDocumentos(item.id)}>Documentos</button>
                    <button type="button" className="btn-danger" onClick={() => eliminarItem(item.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {items.map((item) => (
            itemExpandido === item.id ? (
              <div className="pareo-detail mt-2" key={`detalle-pareo-${item.id}`}>
                <div className="pareo-detail-card">
                  <h4>Encabezado</h4>
                  <p>{item.enunciado}</p>
                </div>

                <div className="pareo-detail-card">
                  <h4>Pareos correctos</h4>
                  <div className="pareo-detail-list">
                    {item.pares?.map((par, index) => (
                      <div className="pareo-detail-row" key={par.id || `${item.id}-${index}`}>
                        <span>{par.izquierda}</span>
                        <strong>{par.derecha}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null
          ))}
        </div>
      </div>
    </div>
  )
}
