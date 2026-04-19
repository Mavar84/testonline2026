import { useEffect, useState } from "react"
import api from "../../services/api"
import DocumentoUploader from "../../components/DocumentoUploader"
import AdminPageHeader from "../../components/AdminPageHeader"
import MathKeyboard from "../../components/MathKeyboard"
import LatexPreview from "../../components/LatexPreview"
import TextTools from "../../components/TextTools"
import SpellingTools from "../../components/SpellingTools"
import { generarOpcionesSeleccionUnica } from "../../services/aiItems"
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

  // VIDEO Y AUDIO ya vienen comprimidos desde MediaRecorder
  // aquí solo retornamos igual
  return file
}
// =========================
// INDEXED DB (LECTURA)
// =========================

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

// =========================
// BASE64
// =========================

// =========================
// ESTADO
// =========================

const estadoInicial = {
  id: null,
  enunciado: "",
  opcion1: "",
  opcion2: "",
  opcion3: "",
  opcion4: "",
  opcion5: "",
  opcion6: "",
  opcion7: "",
  numero_opcion_correcta: "",
  usa_latex: false,
  resultado: "",
  categoria: "",
  comentarios: ""
}

export default function ItemSeleccionUnicaPage() {
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
    const res = await api.get("/items/seleccion-unica/")
    setItems(res.data)
  }

  const manejarCambio = (e) => {
    const { name, value } = e.target
    setFormulario(prev => ({ ...prev, [name]: value }))
  }

  const insertarEnCampo = (name, simbolo) => {
    setFormulario(prev => ({
      ...prev,
      [name]: `${prev[name] || ""}${simbolo}`
    }))
  }

  const actualizarCampo = (name, value) => {
    setFormulario(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const agregarDocumento = (doc) => {
    setDocumentos(prev => [...prev, doc])
  }

  const limpiarFormulario = () => {
    setFormulario(estadoInicial)
    setDocumentos([])
    setTab(0)
  }

  const prepararPayload = () => ({
    ...formulario,
    numero_opcion_correcta: parseInt(formulario.numero_opcion_correcta),
    usa_latex: !!formulario.usa_latex,
    opcion5: formulario.opcion5 || null,
    opcion6: formulario.opcion6 || null,
    opcion7: formulario.opcion7 || null,
    categoria: formulario.categoria || null,
    comentarios: formulario.comentarios || null,
    resultado: formulario.resultado || null
  })

  // =========================
  // 🔥 NUEVA FUNCIÓN CLAVE
  // =========================

  const guardarDocumentosDesdeIndexedDB = async (itemId) => {
  const docsDB = await obtenerDocumentosDB()

  for (let i = 0; i < docsDB.length; i++) {

    const docLocal = docsDB[i]

    try {

      let contexto = window.prompt(
        `Ingrese el contexto para el documento ${i + 1} (${docLocal.tipo})`,
        ""
      ) || ""

      // =========================
      // 🔥 COMPRESIÓN
      // =========================
      const archivoComprimido = await comprimirArchivo(
        docLocal.file,
        docLocal.tipo
      )

      // =========================
      // 🔥 BASE64 LIMPIO
      // =========================
      const base64 = await fileToBase64Limpio(archivoComprimido)
      const tipoNumerico = tipoNumeroPorClave[docLocal.tipo] || 1

      const resDoc = await api.post("/items/documentos/", {
        contenido_base64: base64,
        tipo: tipoNumerico,
        descripcion: docLocal.tipo,
        hash: docLocal.hash,
        mime_type: archivoComprimido.type || mimePorTipo(tipoNumerico)
      })

      const documentoId = resDoc.data.id

      await api.post("/items/seleccion-unica-documentos/", {
        item: itemId,
        documento: documentoId,
        orden: i + 1,
        contexto: contexto
      })

    } catch (error) {
      console.error("Error procesando documento:", error.response?.data || error)
    }
  }
}

  // =========================
  // GUARDAR
  // =========================

  const guardar = async (e) => {
    e.preventDefault()

    try {
      const payload = prepararPayload()

      let res

      if (formulario.id) {
        res = await api.put(`/items/seleccion-unica/${formulario.id}/`, payload)
        alert("Item actualizado")
      } else {
        res = await api.post("/items/seleccion-unica/", payload)
        alert("Item creado")
      }

      const itemId = res.data.id

      // =========================
      // 🔥 NUEVO FLUJO DOCUMENTOS
      // =========================

      await guardarDocumentosDesdeIndexedDB(itemId)

      limpiarFormulario()
      cargarItems()

    } catch (error) {
      console.log(error.response?.data)
      alert("Error guardando")
    }
  }

  const editarItem = (item) => {
    setFormulario({
      ...item,
      numero_opcion_correcta: item.numero_opcion_correcta || ""
    })
    setTab(0)
  }

  const eliminarItem = async (id) => {
    const confirmar = window.confirm("¿Desea eliminar este ítem?")
    if (!confirmar) return

    try {
      await api.delete(`/items/seleccion-unica/${id}/`)
      alert("Ítem eliminado")
      cargarItems()
    } catch (error) {
      console.log(error.response?.data)
      alert("Error eliminando")
    }
  }

  const verDocumentos = (id) => {
    window.open(`/admin/items-seleccion/${id}/documentos`, "_blank", "noopener,noreferrer")
  }

  const rellenarConIA = async () => {
    if (!formulario.enunciado.trim()) {
      alert("Ingrese primero el enunciado del ítem")
      return
    }

    try {
      setGenerandoIA(true)
      const data = await generarOpcionesSeleccionUnica(formulario.enunciado)

      setFormulario(prev => ({
        ...prev,
        opcion1: data.opciones[0] || "",
        opcion2: data.opciones[1] || "",
        opcion3: data.opciones[2] || "",
        opcion4: data.opciones[3] || "",
        opcion5: data.opciones[4] || "",
        opcion6: data.opciones[5] || "",
        opcion7: data.opciones[6] || "",
        numero_opcion_correcta: String(data.correcta)
      }))

      setTab(1)
    } catch (error) {
      console.error(error)
      alert("No se pudieron generar las opciones con IA")
    } finally {
      setGenerandoIA(false)
    }
  }

  return (
    <div className="bg-gradient">
      <div className="container">
        <AdminPageHeader
          title="Ítems Selección Única"
          subtitle="Crea preguntas con opciones, respuesta correcta y documentos asociados."
        />

        <div className="card">
          <h2>Ítem Selección Única</h2>

          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <button className={tab === 0 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(0)}>General</button>
            <button className={tab === 1 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(1)}>Opciones</button>
            <button className={tab === 2 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(2)}>Documentos</button>
            <button className={tab === 3 ? "btn-primary" : "btn-secondary"} onClick={() => setTab(3)}>Configuración</button>
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
                  onInsert={(texto) => insertarEnCampo("enunciado", texto)}
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

                {[1,2,3,4,5,6,7].map(i => (
                  <div key={i}>
                    <label>Opción {i}</label>
                    <textarea
                      name={`opcion${i}`}
                      value={formulario[`opcion${i}`] || ""}
                      onChange={manejarCambio}
                      {...propsOrtografia}
                    />
                    <TextTools
                      value={formulario[`opcion${i}`] || ""}
                      onChange={(value) => actualizarCampo(`opcion${i}`, value)}
                      onInsert={(texto) => insertarEnCampo(`opcion${i}`, texto)}
                    />
                    <LatexPreview
                      visible={formulario.usa_latex}
                      value={formulario[`opcion${i}`] || ""}
                    />
                    <MathKeyboard
                      activo={tecladoMatematico}
                      onInsert={(simbolo) => insertarEnCampo(`opcion${i}`, simbolo)}
                    />
                  </div>
                ))}
              </>
            )}

            {tab === 2 && (
              <DocumentoUploader onDocumentoAgregado={agregarDocumento} />
            )}

            {tab === 3 && (
              <>
                <label>Opción correcta</label>
                <input
                  type="number"
                  name="numero_opcion_correcta"
                  value={formulario.numero_opcion_correcta}
                  onChange={manejarCambio}
                  min="1"
                  max="7"
                />

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
                  onInsert={(texto) => insertarEnCampo("categoria", texto)}
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
                  onInsert={(texto) => insertarEnCampo("comentarios", texto)}
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
                <th>Correcta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.enunciado?.substring(0, 50)}...</td>
                  <td>{item.numero_opcion_correcta}</td>
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
