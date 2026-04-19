import { useEffect, useState } from "react"
import api from "../../services/api"
import DocumentoUploader from "../../components/DocumentoUploader"
import AdminPageHeader from "../../components/AdminPageHeader"
import MathKeyboard from "../../components/MathKeyboard"
import LatexPreview from "../../components/LatexPreview"
import TextTools from "../../components/TextTools"
import SpellingTools from "../../components/SpellingTools"
import { generarRespuestasUnicas } from "../../services/aiItems"
import { fileToBase64Limpio, mimePorTipo, tipoNumeroPorClave } from "../../services/documentos"

const comprimirImagen = (file, calidad = 0.6, maxAncho = 1280) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()

    reader.onload = e => {
      img.src = e.target.result
    }

    img.onload = () => {
      const canvas = document.createElement("canvas")

      let ancho = img.width
      let alto = img.height

      if (ancho > maxAncho) {
        alto = alto * (maxAncho / ancho)
        ancho = maxAncho
      }

      canvas.width = ancho
      canvas.height = alto

      const ctx = canvas.getContext("2d")
      ctx.drawImage(img, 0, 0, ancho, alto)

      canvas.toBlob(
        (blob) => {
          const archivoComprimido = new File([blob], file.name, {
            type: "image/jpeg"
          })
          resolve(archivoComprimido)
        },
        "image/jpeg",
        calidad
      )
    }

    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const comprimirArchivo = async (file, tipo) => {
  if (tipo === "imagen") {
    return await comprimirImagen(file, 0.6, 1280)
  }

  return file
}

const abrirDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("documentosDB", 5)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

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

const estadoInicial = {
  id: null,
  enunciado: "",
  usa_latex: false,
  resultado: "",
  categoria: "",
  comentarios: "",
  respuestas: [""]
}

const parsearRespuestas = (respuestaEjemplo) => {
  if (!respuestaEjemplo) return [""]

  try {
    const data = JSON.parse(respuestaEjemplo)
    if (Array.isArray(data.respuestas) && data.respuestas.length > 0) {
      return data.respuestas
    }
  } catch {
    return [respuestaEjemplo]
  }

  return [""]
}

export default function ItemRespuestaUnicaPage() {
  const [tab, setTab] = useState(0)
  const [formulario, setFormulario] = useState(estadoInicial)
  const [resultados, setResultados] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [items, setItems] = useState([])
  const [tecladoMatematico, setTecladoMatematico] = useState(false)
  const [generandoIA, setGenerandoIA] = useState(false)
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
    const res = await api.get("/items/respuesta-unica/")
    setItems(res.data)
  }

  const manejarCambio = (e) => {
    const { name, value } = e.target
    setFormulario(prev => ({ ...prev, [name]: value }))
  }

  const actualizarCampo = (name, value) => {
    setFormulario(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const manejarRespuesta = (index, value) => {
    setFormulario(prev => {
      const respuestas = [...prev.respuestas]
      respuestas[index] = value
      return { ...prev, respuestas }
    })
  }

  const agregarRespuesta = () => {
    setFormulario(prev => ({
      ...prev,
      respuestas: [...prev.respuestas, ""]
    }))
  }

  const eliminarRespuesta = (index) => {
    setFormulario(prev => {
      const respuestas = prev.respuestas.filter((_, i) => i !== index)
      return { ...prev, respuestas: respuestas.length > 0 ? respuestas : [""] }
    })
  }

  const agregarDocumento = (doc) => {
    setDocumentos(prev => [...prev, doc])
  }

  const limpiarFormulario = () => {
    setFormulario(estadoInicial)
    setDocumentos([])
    setTab(0)
  }

  const prepararPayload = () => {
    const respuestasLimpias = formulario.respuestas
      .map(respuesta => respuesta.trim())
      .filter(Boolean)

    return {
      enunciado: formulario.enunciado,
      usa_latex: !!formulario.usa_latex,
      respuesta_ejemplo: JSON.stringify({ respuestas: respuestasLimpias }),
      resultado: formulario.resultado || null,
      categoria: formulario.categoria || null,
      comentarios: formulario.comentarios || null
    }
  }

  const guardarDocumentosDesdeIndexedDB = async (itemId) => {
    const docsDB = await obtenerDocumentosDB()

    for (let i = 0; i < docsDB.length; i++) {
      const docLocal = docsDB[i]

      try {
        const contexto = window.prompt(
          `Ingrese el contexto para el documento ${i + 1} (${docLocal.tipo})`,
          ""
        ) || ""

        const archivoComprimido = await comprimirArchivo(
          docLocal.file,
          docLocal.tipo
        )

        const base64 = await fileToBase64Limpio(archivoComprimido)
        const tipoNumerico = tipoNumeroPorClave[docLocal.tipo] || 1

        const resDoc = await api.post("/items/documentos/", {
          contenido_base64: base64,
          tipo: tipoNumerico,
          descripcion: docLocal.tipo,
          hash: docLocal.hash,
          mime_type: archivoComprimido.type || mimePorTipo(tipoNumerico)
        })

        await api.post("/items/respuesta-unica-documentos/", {
          item: itemId,
          documento: resDoc.data.id,
          orden: i + 1,
          contexto: contexto
        })
      } catch (error) {
        console.error("Error procesando documento:", error.response?.data || error)
      }
    }
  }

  const guardar = async (e) => {
    e.preventDefault()

    const respuestasLimpias = formulario.respuestas
      .map(respuesta => respuesta.trim())
      .filter(Boolean)

    if (!formulario.enunciado.trim() || respuestasLimpias.length === 0) {
      alert("Ingrese el enunciado y al menos una respuesta esperada")
      return
    }

    try {
      const payload = prepararPayload()
      let res

      if (formulario.id) {
        res = await api.put(`/items/respuesta-unica/${formulario.id}/`, payload)
        alert("Item actualizado")
      } else {
        res = await api.post("/items/respuesta-unica/", payload)
        alert("Item creado")
      }

      await guardarDocumentosDesdeIndexedDB(res.data.id)

      limpiarFormulario()
      cargarItems()
    } catch (error) {
      console.log(error.response?.data)
      alert("Error guardando")
    }
  }

  const editarItem = (item) => {
    setFormulario({
      id: item.id,
      enunciado: item.enunciado || "",
      resultado: item.resultado || "",
      usa_latex: !!item.usa_latex,
      categoria: item.categoria || "",
      comentarios: item.comentarios || "",
      respuestas: parsearRespuestas(item.respuesta_ejemplo)
    })
    setTab(0)
  }

  const eliminarItem = async (id) => {
    const confirmar = window.confirm("¿Desea eliminar este ítem?")
    if (!confirmar) return

    try {
      await api.delete(`/items/respuesta-unica/${id}/`)
      alert("Ítem eliminado")
      cargarItems()
    } catch (error) {
      console.log(error.response?.data)
      alert("Error eliminando")
    }
  }

  const verDocumentos = (id) => {
    window.open(`/admin/items-respuesta/${id}/documentos`, "_blank", "noopener,noreferrer")
  }

  const insertarRespuesta = (index, simbolo) => {
    setFormulario(prev => {
      const respuestas = [...prev.respuestas]
      respuestas[index] = `${respuestas[index] || ""}${simbolo}`
      return { ...prev, respuestas }
    })
  }

  const actualizarRespuesta = (index, value) => {
    setFormulario(prev => {
      const respuestas = [...prev.respuestas]
      respuestas[index] = value
      return { ...prev, respuestas }
    })
  }

  const rellenarConIA = async () => {
    if (!formulario.enunciado.trim()) {
      alert("Ingrese primero el enunciado del ítem")
      return
    }

    try {
      setGenerandoIA(true)
      const respuestas = await generarRespuestasUnicas(formulario.enunciado)

      setFormulario(prev => ({
        ...prev,
        respuestas
      }))

      setTab(1)
    } catch (error) {
      console.error(error)
      alert("No se pudieron generar las respuestas con IA")
    } finally {
      setGenerandoIA(false)
    }
  }

  return (
    <div className="bg-gradient">
      <div className="container">
        <AdminPageHeader
          title="Ítems Respuesta Única"
          subtitle="Crea ítems abiertos con una o varias respuestas esperadas."
        />

        <div className="card">
          <h2>Ítem Respuesta Única</h2>

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button type="button" className={tab === 0 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(0)}>General</button>
            <button type="button" className={tab === 1 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(1)}>Respuestas</button>
            <button type="button" className={tab === 2 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(2)}>Documentos</button>
            <button type="button" className={tab === 3 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(3)}>Configuración</button>
          </div>

          <form onSubmit={guardar}>
            {tab === 0 && (
              <>
                <label>Resultado</label>
                <select name="resultado" value={formulario.resultado} onChange={manejarCambio}>
                  <option value="">Seleccione</option>
                  {resultados.map(r => (
                    <option key={r.id} value={r.id}>{r.texto}</option>
                  ))}
                </select>

                <label>Enunciado</label>
                <textarea
                  name="enunciado"
                  value={formulario.enunciado}
                  onChange={manejarCambio}
                  {...propsOrtografia}
                />
                <TextTools
                  value={formulario.enunciado}
                  onChange={(value) => actualizarCampo("enunciado", value)}
                  onInsert={(texto) => actualizarCampo("enunciado", `${formulario.enunciado || ""}${texto}`)}
                />
                <SpellingTools
                  language={idiomaOrtografia}
                  onLanguageChange={setIdiomaOrtografia}
                />
                <LatexPreview visible={formulario.usa_latex} value={formulario.enunciado} />
              </>
            )}

            {tab === 1 && (
              <>
                <div className="form-tools">
                  <label className="switch-control">
                    <input
                      type="checkbox"
                      checked={tecladoMatematico}
                      onChange={(e) => {
                        setTecladoMatematico(e.target.checked)
                        if (e.target.checked) actualizarCampo("usa_latex", true)
                      }}
                    />
                    <span></span>
                    Teclado LaTeX
                  </label>

                  <button
                    type="button"
                    className="btn-success"
                    onClick={rellenarConIA}
                    disabled={generandoIA}
                  >
                    {generandoIA ? "Generando..." : "Rellenar con IA"}
                  </button>
                </div>

                {formulario.respuestas.map((respuesta, index) => (
                  <div className="answer-row" key={index}>
                    <label>Respuesta esperada {index + 1}</label>
                    <textarea
                      value={respuesta}
                      onChange={(e) => manejarRespuesta(index, e.target.value)}
                      {...propsOrtografia}
                    />
                    <TextTools
                      value={respuesta}
                      onChange={(value) => actualizarRespuesta(index, value)}
                      onInsert={(texto) => insertarRespuesta(index, texto)}
                    />
                    <LatexPreview visible={formulario.usa_latex} value={respuesta} />
                    <MathKeyboard
                      activo={tecladoMatematico}
                      onInsert={(simbolo) => insertarRespuesta(index, simbolo)}
                    />

                    {formulario.respuestas.length > 1 && (
                      <button type="button" className="btn-danger" onClick={() => eliminarRespuesta(index)}>
                        Eliminar respuesta
                      </button>
                    )}
                  </div>
                ))}

                <button type="button" className="btn-success mt-1" onClick={agregarRespuesta}>
                  Agregar respuesta
                </button>
              </>
            )}

            {tab === 2 && (
              <DocumentoUploader onDocumentoAgregado={agregarDocumento} />
            )}

            {tab === 3 && (
              <>
                <label>Categoría</label>
                <input
                  name="categoria"
                  value={formulario.categoria}
                  onChange={manejarCambio}
                  {...propsOrtografia}
                />
                <TextTools
                  value={formulario.categoria}
                  onChange={(value) => actualizarCampo("categoria", value)}
                  onInsert={(texto) => actualizarCampo("categoria", `${formulario.categoria || ""}${texto}`)}
                />
                <LatexPreview visible={formulario.usa_latex} value={formulario.categoria} />

                <label>Comentarios</label>
                <textarea
                  name="comentarios"
                  value={formulario.comentarios}
                  onChange={manejarCambio}
                  {...propsOrtografia}
                />
                <TextTools
                  value={formulario.comentarios}
                  onChange={(value) => actualizarCampo("comentarios", value)}
                  onInsert={(texto) => actualizarCampo("comentarios", `${formulario.comentarios || ""}${texto}`)}
                />
                <LatexPreview visible={formulario.usa_latex} value={formulario.comentarios} />

                <label className="switch-control field-switch">
                  <input
                    type="checkbox"
                    checked={!!formulario.usa_latex}
                    onChange={(e) => actualizarCampo("usa_latex", e.target.checked)}
                  />
                  <span></span>
                  Guardar este ítem como contenido matemático LaTeX
                </label>
              </>
            )}

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
                <th>Respuestas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.enunciado?.substring(0, 50)}...</td>
                  <td>{parsearRespuestas(item.respuesta_ejemplo).filter(Boolean).length}</td>
                  <td style={{ display: "flex", gap: 8 }}>
                    <button className="btn-primary" onClick={() => verDocumentos(item.id)}>Documentos</button>
                    <button className="btn-secondary" onClick={() => editarItem(item)}>Editar</button>
                    <button className="btn-danger" onClick={() => eliminarItem(item.id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
