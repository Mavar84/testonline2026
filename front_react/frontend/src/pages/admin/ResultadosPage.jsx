import { useEffect, useState } from "react"
import api from "../../services/api"
import AdminPageHeader from "../../components/AdminPageHeader"

const estadoInicial = {
  id: null,
  texto: "",
  codigo: "",
  subtema: ""
}

export default function ResultadosPage() {

  const [resultados, setResultados] = useState([])
  const [programas, setProgramas] = useState([])
  const [subareas, setSubareas] = useState([])
  const [subtemas, setSubtemas] = useState([])

  const [programaSeleccionado, setProgramaSeleccionado] = useState("")
  const [subareaSeleccionada, setSubareaSeleccionada] = useState("")

  const [formulario, setFormulario] = useState(estadoInicial)
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    listarResultados()
    listarProgramas()
  }, [])

  const listarResultados = async () => {
    const res = await api.get("/core/resultados/")
    setResultados(res.data)
  }

  const listarProgramas = async () => {
    const res = await api.get("/core/programas/")
    setProgramas(res.data)
  }

  const cargarSubareas = async (programaId) => {
    const res = await api.get("/core/subareas/")
    const filtradas = res.data.filter(s => s.programa === parseInt(programaId))
    setSubareas(filtradas)
  }

  const cargarSubtemas = async (subareaId) => {
    const res = await api.get("/core/subtemas/")
    const filtrados = res.data.filter(s => s.subarea === parseInt(subareaId))
    setSubtemas(filtrados)
  }

  const manejarCambio = (e) => {
    const { name, value } = e.target
    setFormulario({ ...formulario, [name]: value })
  }

  const limpiar = () => {
    setFormulario(estadoInicial)
    setEditando(false)
  }

  const guardar = async (e) => {
    e.preventDefault()

    if (!formulario.texto || !formulario.subtema) {
      alert("Complete los campos obligatorios")
      return
    }

    if (editando) {
      await api.put(`/core/resultados/${formulario.id}/`, formulario)
    } else {
      await api.post("/core/resultados/", formulario)
    }

    limpiar()
    listarResultados()
  }

  const editar = (item) => {
    setFormulario(item)
    setEditando(true)
  }

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar resultado?")) return

    await api.delete(`/core/resultados/${id}/`)
    listarResultados()
  }

  return (
    <div className="bg-gradient">
      <div className="container">
        <AdminPageHeader
          title="Resultados de Aprendizaje"
          subtitle="Gestiona los resultados usados para clasificar los ítems."
        />

        <div className="card">
          <h2>Resultados de Aprendizaje</h2>

          {/* PROGRAMA */}
          <label>Programa</label>
          <select
            value={programaSeleccionado}
            onChange={(e) => {
              setProgramaSeleccionado(e.target.value)
              cargarSubareas(e.target.value)
            }}
          >
            <option value="">Seleccione</option>
            {programas.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>

          {/* SUBAREA */}
          <label>Subárea</label>
          <select
            value={subareaSeleccionada}
            onChange={(e) => {
              setSubareaSeleccionada(e.target.value)
              cargarSubtemas(e.target.value)
            }}
          >
            <option value="">Seleccione</option>
            {subareas.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>

          {/* FORM */}
          <form onSubmit={guardar}>

            <label>Subtema</label>
            <select
              name="subtema"
              value={formulario.subtema}
              onChange={manejarCambio}
            >
              <option value="">Seleccione</option>
              {subtemas.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>

            <label>Código</label>
            <input
              name="codigo"
              value={formulario.codigo}
              onChange={manejarCambio}
            />

            <label>Descripción</label>
            <textarea
  name="texto"
  value={formulario.texto}
  onChange={manejarCambio}
/>

            <div className="mt-1">
              <button className="btn-primary">
                {editando ? "Actualizar" : "Guardar"}
              </button>

              <button type="button" className="btn-secondary" onClick={limpiar}>
                Limpiar
              </button>
            </div>

          </form>
        </div>

        {/* TABLA */}
        <div className="card mt-2">
          <h3>Listado</h3>

          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
            
                <th>Texto</th>
                <th>Subtema</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {resultados.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                 <td>{r.texto}</td>
                  <td>{r.subtema_nombre || r.subtema}</td>
                  <td>
                    <button className="btn-success" onClick={() => editar(r)}>
                      Editar
                    </button>

                    <button className="btn-danger" onClick={() => eliminar(r.id)}>
                      Eliminar
                    </button>
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
