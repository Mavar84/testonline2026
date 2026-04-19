import { useEffect, useState } from "react"
import api from "../../services/api"
import AdminPageHeader from "../../components/AdminPageHeader"

const estadoInicial = {
  id: null,
  nombre: "",
  descripcion: "",
  subarea: ""
}

export default function SubtemasPage() {

  const [subtemas, setSubtemas] = useState([])
  const [programas, setProgramas] = useState([])
  const [subareas, setSubareas] = useState([])

  const [programaSeleccionado, setProgramaSeleccionado] = useState("")
  const [formulario, setFormulario] = useState(estadoInicial)
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    listarSubtemas()
    listarProgramas()
  }, [])

  const listarSubtemas = async () => {
    const res = await api.get("/core/subtemas/")
    setSubtemas(res.data)
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

    if (!formulario.nombre || !formulario.subarea) {
      alert("Complete los campos obligatorios")
      return
    }

    if (editando) {
      await api.put(`/core/subtemas/${formulario.id}/`, formulario)
    } else {
      await api.post("/core/subtemas/", formulario)
    }

    limpiar()
    listarSubtemas()
  }

  const editar = (item) => {
    setFormulario(item)
    setEditando(true)
  }

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar subtema?")) return

    await api.delete(`/core/subtemas/${id}/`)
    listarSubtemas()
  }

  return (
    <div className="bg-gradient">
      <div className="container">
        <AdminPageHeader
          title="Subtemas"
          subtitle="Define los contenidos específicos para cada subárea."
        />

        {/* FORM */}
        <div className="card">
          <h2>Subtemas</h2>

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

          <form onSubmit={guardar}>

            <label>Subárea</label>
            <select
              name="subarea"
              value={formulario.subarea}
              onChange={manejarCambio}
            >
              <option value="">Seleccione</option>
              {subareas.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>

            <label>Nombre</label>
            <input
              name="nombre"
              value={formulario.nombre}
              onChange={manejarCambio}
            />

            <label>Descripción</label>
            <textarea
              name="descripcion"
              value={formulario.descripcion}
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
                <th>Nombre</th>
                <th>Subárea</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {subtemas.map(s => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.nombre}</td>
                  <td>{s.subarea_nombre || s.subarea}</td>
                  <td>
                    <button className="btn-success" onClick={() => editar(s)}>
                      Editar
                    </button>

                    <button className="btn-danger" onClick={() => eliminar(s.id)}>
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
