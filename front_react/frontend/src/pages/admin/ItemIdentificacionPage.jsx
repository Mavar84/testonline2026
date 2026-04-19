import { useEffect, useMemo, useRef, useState } from "react"
import api from "../../services/api"
import DocumentoUploader from "../../components/DocumentoUploader"
import AdminPageHeader from "../../components/AdminPageHeader"
import TextTools from "../../components/TextTools"
import SpellingTools from "../../components/SpellingTools"
import { fileToBase64Limpio, mimePorTipo, tipoNumeroPorClave } from "../../services/documentos"

const estadoInicial = {
  id: null,
  enunciado: "",
  descripcion: "",
  resultado: "",
  imagen: "",
  componentes: []
}

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
})

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

export default function ItemIdentificacionPage() {
  const imageAreaRef = useRef(null)
  const [tab, setTab] = useState(0)
  const [formulario, setFormulario] = useState(estadoInicial)
  const [resultados, setResultados] = useState([])
  const [items, setItems] = useState([])
  const [itemExpandido, setItemExpandido] = useState(null)
  const [idiomaOrtografia, setIdiomaOrtografia] = useState("es")
  const [seleccionado, setSeleccionado] = useState(null)

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
    const [itemsRes, componentesRes] = await Promise.all([
      api.get("/items/identificacion/"),
      api.get("/items/identificacion-componentes/")
    ])

    const completos = itemsRes.data.map((item) => ({
      ...item,
      componentes: componentesRes.data.filter((comp) => comp.item === item.id)
    }))

    setItems(completos)
  }

  const actualizarCampo = (name, value) => {
    setFormulario((prev) => ({ ...prev, [name]: value }))
  }

  const limpiarFormulario = () => {
    setFormulario(estadoInicial)
    setSeleccionado(null)
    setTab(0)
  }

  const cargarImagen = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const imageData = await fileToDataUrl(file)
    setFormulario((prev) => ({
      ...prev,
      imagen: imageData,
      componentes: []
    }))
    setSeleccionado(null)
  }

  const agregarPin = (e) => {
    if (!imageAreaRef.current || !formulario.imagen) return

    const rect = imageAreaRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const nuevo = {
      tempId: crypto.randomUUID(),
      coordenada_x: x.toFixed(2),
      coordenada_y: y.toFixed(2),
      respuesta_correcta: ""
    }

    setFormulario((prev) => ({
      ...prev,
      componentes: [...prev.componentes, nuevo]
    }))
    setSeleccionado(nuevo.tempId)
  }

  const actualizarComponente = (id, respuesta) => {
    setFormulario((prev) => ({
      ...prev,
      componentes: prev.componentes.map((comp) =>
        (comp.tempId || comp.id) === id
          ? { ...comp, respuesta_correcta: respuesta }
          : comp
      )
    }))
  }

  const eliminarComponente = (id) => {
    setFormulario((prev) => ({
      ...prev,
      componentes: prev.componentes.filter((comp) => (comp.tempId || comp.id) !== id)
    }))
    setSeleccionado(null)
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

        await api.post("/items/identificacion-documentos/", {
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

  const guardarComponentes = async (itemId) => {
    const existentesRes = await api.get("/items/identificacion-componentes/")
    const existentes = existentesRes.data.filter((comp) => comp.item === itemId)

    await Promise.all(
      existentes.map((comp) => api.delete(`/items/identificacion-componentes/${comp.id}/`))
    )

    const nuevos = formulario.componentes
      .map((comp) => ({
        item: itemId,
        coordenada_x: comp.coordenada_x,
        coordenada_y: comp.coordenada_y,
        respuesta_correcta: comp.respuesta_correcta?.trim()
      }))
      .filter((comp) => comp.respuesta_correcta)

    await Promise.all(
      nuevos.map((comp) => api.post("/items/identificacion-componentes/", comp))
    )
  }

  const guardar = async (e) => {
    e.preventDefault()
    const componentesValidos = formulario.componentes.filter((comp) => comp.respuesta_correcta?.trim())

    if (!formulario.enunciado.trim() || !formulario.imagen || componentesValidos.length === 0) {
      alert("Complete enunciado, imagen y al menos un pin con respuesta")
      return
    }

    try {
      const payload = {
        enunciado: formulario.enunciado,
        descripcion: formulario.descripcion || null,
        imagen: formulario.imagen,
        resultado: formulario.resultado || null
      }

      let res
      if (formulario.id) {
        res = await api.put(`/items/identificacion/${formulario.id}/`, payload)
        alert("Ítem actualizado")
      } else {
        res = await api.post("/items/identificacion/", payload)
        alert("Ítem creado")
      }

      await guardarComponentes(res.data.id)
      await guardarDocumentosDesdeIndexedDB(res.data.id)

      limpiarFormulario()
      cargarItems()
    } catch (error) {
      console.error(error.response?.data || error)
      alert("Error guardando")
    }
  }

  const editarItem = (item) => {
    setFormulario({
      id: item.id,
      enunciado: item.enunciado || "",
      descripcion: item.descripcion || "",
      resultado: item.resultado || "",
      imagen: item.imagen || "",
      componentes: (item.componentes || []).map((comp) => ({ ...comp, tempId: comp.id }))
    })
    setSeleccionado(null)
    setTab(0)
  }

  const eliminarItem = async (id) => {
    if (!window.confirm("¿Desea eliminar este ítem?")) return
    await api.delete(`/items/identificacion/${id}/`)
    cargarItems()
  }

  const verDocumentos = (id) => {
    window.open(`/admin/items-identificacion/${id}/documentos`, "_blank", "noopener,noreferrer")
  }

  const pinSeleccionado = useMemo(
    () => formulario.componentes.find((comp) => (comp.tempId || comp.id) === seleccionado),
    [formulario.componentes, seleccionado]
  )

  return (
    <div className="bg-gradient">
      <div className="container">
        <AdminPageHeader
          title="Ítems de Identificación"
          subtitle="Carga una imagen, marca zonas con pines y define la respuesta correcta para cada una."
        />

        <div className="card">
          <h2>Ítem de Identificación</h2>

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button type="button" className={tab === 0 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(0)}>General</button>
            <button type="button" className={tab === 1 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(1)}>Imagen y pines</button>
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

                <label>Enunciado</label>
                <textarea value={formulario.enunciado} onChange={(e) => actualizarCampo("enunciado", e.target.value)} {...propsOrtografia} />
                <TextTools
                  value={formulario.enunciado}
                  onChange={(value) => actualizarCampo("enunciado", value)}
                  onInsert={(texto) => actualizarCampo("enunciado", `${formulario.enunciado}${texto}`)}
                />
                <SpellingTools language={idiomaOrtografia} onLanguageChange={setIdiomaOrtografia} />

                <label>Descripción</label>
                <textarea value={formulario.descripcion} onChange={(e) => actualizarCampo("descripcion", e.target.value)} {...propsOrtografia} />
                <TextTools
                  value={formulario.descripcion}
                  onChange={(value) => actualizarCampo("descripcion", value)}
                  onInsert={(texto) => actualizarCampo("descripcion", `${formulario.descripcion}${texto}`)}
                />
              </>
            )}

            {tab === 1 && (
              <>
                <label>Imagen base</label>
                <input type="file" accept="image/*" onChange={cargarImagen} />

                <div className="identification-layout">
                  <div className="identification-stage" ref={imageAreaRef} onClick={agregarPin}>
                    {formulario.imagen ? (
                      <>
                        <img src={formulario.imagen} alt="Base para identificación" />
                        {formulario.componentes.map((comp, index) => (
                          <button
                            type="button"
                            key={comp.tempId || comp.id}
                            className={`identification-pin ${seleccionado === (comp.tempId || comp.id) ? "active" : ""}`}
                            style={{ left: `${comp.coordenada_x}%`, top: `${comp.coordenada_y}%` }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSeleccionado(comp.tempId || comp.id)
                            }}
                          >
                            {index + 1}
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="identification-empty">Cargue una imagen para comenzar a marcar pines.</div>
                    )}
                  </div>

                  <aside className="identification-sidebar">
                    <h3>Pines</h3>

                    {pinSeleccionado ? (
                      <div className="identification-editor">
                        <p>Pin en X {pinSeleccionado.coordenada_x}% / Y {pinSeleccionado.coordenada_y}%</p>
                        <label>Respuesta correcta</label>
                        <input
                          value={pinSeleccionado.respuesta_correcta || ""}
                          onChange={(e) => actualizarComponente(pinSeleccionado.tempId || pinSeleccionado.id, e.target.value)}
                          {...propsOrtografia}
                        />
                        <TextTools
                          value={pinSeleccionado.respuesta_correcta || ""}
                          onChange={(value) => actualizarComponente(pinSeleccionado.tempId || pinSeleccionado.id, value)}
                          onInsert={(texto) => actualizarComponente(pinSeleccionado.tempId || pinSeleccionado.id, `${pinSeleccionado.respuesta_correcta || ""}${texto}`)}
                        />
                        <button type="button" className="btn-danger" onClick={() => eliminarComponente(pinSeleccionado.tempId || pinSeleccionado.id)}>
                          Eliminar pin
                        </button>
                      </div>
                    ) : (
                      <p>Seleccione un pin para editar su respuesta.</p>
                    )}

                    <div className="identification-pin-list">
                      {formulario.componentes.map((comp, index) => (
                        <button
                          type="button"
                          key={comp.tempId || comp.id}
                          className="identification-pin-row"
                          onClick={() => setSeleccionado(comp.tempId || comp.id)}
                        >
                          <strong>Pin {index + 1}</strong>
                          <small>{comp.respuesta_correcta || "Sin respuesta todavía"}</small>
                        </button>
                      ))}
                    </div>
                  </aside>
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
          <h3>Listado de ítems</h3>

          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Enunciado</th>
                <th>Pines</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.enunciado?.substring(0, 60)}...</td>
                  <td>{item.componentes?.length || 0}</td>
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
              <div className="identification-detail mt-2" key={`detalle-${item.id}`}>
                <div className="identification-stage readonly">
                  {item.imagen ? (
                    <>
                      <img src={item.imagen} alt={`Detalle item ${item.id}`} />
                      {item.componentes?.map((comp, index) => (
                        <span
                          key={comp.id}
                          className="identification-pin active"
                          style={{ left: `${comp.coordenada_x}%`, top: `${comp.coordenada_y}%` }}
                        >
                          {index + 1}
                        </span>
                      ))}
                    </>
                  ) : (
                    <div className="identification-empty">Sin imagen</div>
                  )}
                </div>

                <div className="identification-detail-meta">
                  <p><strong>Descripción:</strong> {item.descripcion || "Sin descripción"}</p>
                  <ul>
                    {item.componentes?.map((comp, index) => (
                      <li key={comp.id}>
                        <strong>Pin {index + 1}:</strong> {comp.respuesta_correcta}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null
          ))}
        </div>
      </div>
    </div>
  )
}
