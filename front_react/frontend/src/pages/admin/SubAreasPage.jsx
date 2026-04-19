import { useEffect, useState } from "react"
import api from "../../services/api"
import AdminPageHeader from "../../components/AdminPageHeader"

const estadoInicial = {
  id: null,
  nombre: "",
  programa: ""
}

export default function SubAreasPage() {
  const [subareas, setSubareas] = useState([])
  const [programas, setProgramas] = useState([])
  const [formulario, setFormulario] = useState(estadoInicial)
  const [editando, setEditando] = useState(false)

  useEffect(() => {
    listarSubareas()
    listarProgramas()
  }, [])

  const listarSubareas = async () => {
    const res = await api.get("/core/subareas/")
    setSubareas(res.data)
  }

  const listarProgramas = async () => {
    const res = await api.get("/core/programas/")
    setProgramas(res.data)
  }

  const manejarCambio = (e) => {
    const { name, value } = e.target
    setFormulario({
      ...formulario,
      [name]: value
    })
  }

  const limpiar = () => {
    setFormulario(estadoInicial)
    setEditando(false)
  }

  const guardar = async (e) => {
    e.preventDefault()

    if (!formulario.nombre || !formulario.programa) {
      alert("Complete todos los campos")
      return
    }

    if (editando) {
      await api.put(`/core/subareas/${formulario.id}/`, formulario)
    } else {
      await api.post("/core/subareas/", formulario)
    }

    limpiar()
    listarSubareas()
  }

  const editar = (item) => {
    setFormulario({
      id: item.id,
      nombre: item.nombre,
      programa: item.programa
    })
    setEditando(true)
  }

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar subárea?")) return

    await api.delete(`/core/subareas/${id}/`)
    listarSubareas()
  }

  const obtenerNombrePrograma = (id) => {
    const p = programas.find(p => p.id === id)
    return p ? p.nombre : "—"
  }

  return (
    <div className="bg-gradient">
      <div className="container">
        <AdminPageHeader
          title="Subáreas"
          subtitle="Organiza las subáreas asociadas a cada programa."
        />

        {/* FORMULARIO */}
        <div className="card">
          <h2>Subáreas</h2>

          <form onSubmit={guardar}>
            <label>Nombre</label>
            <input
              name="nombre"
              value={formulario.nombre}
              onChange={manejarCambio}
            />

            <label>Programa</label>
            <select
              name="programa"
              value={formulario.programa}
              onChange={manejarCambio}
            >
              <option value="">Seleccione</option>
              {programas.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>

            <div className="mt-1" style={{ display: "flex", gap: 10 }}>
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
                <th>Programa</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {subareas.map(s => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.nombre}</td>
                  <td>{obtenerNombrePrograma(s.programa)}</td>
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
