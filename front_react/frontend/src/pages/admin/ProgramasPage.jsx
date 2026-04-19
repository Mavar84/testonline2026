import { useEffect, useState } from "react"
import api from "../../services/api"
import AdminPageHeader from "../../components/AdminPageHeader"

const estadoInicial = {
  id: null,
  nombre: "",
  descripcion: ""
}

export default function ProgramasPage() {
  const [programas, setProgramas] = useState([])
  const [formulario, setFormulario] = useState(estadoInicial)
  const [editando, setEditando] = useState(false)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    listarProgramas()
  }, [])

  const listarProgramas = async () => {
    try {
      setCargando(true)
      const res = await api.get("/core/programas/")
      setProgramas(res.data)
    } catch (error) {
      console.error(error)
      alert("Error al cargar programas")
    } finally {
      setCargando(false)
    }
  }

  const manejarCambio = (e) => {
    const { name, value } = e.target
    setFormulario({
      ...formulario,
      [name]: value
    })
  }

  const limpiarFormulario = () => {
    setFormulario(estadoInicial)
    setEditando(false)
  }

  const guardarPrograma = async (e) => {
    e.preventDefault()

    if (!formulario.nombre.trim()) {
      alert("El nombre es obligatorio")
      return
    }

    try {
      if (editando && formulario.id) {
        await api.put(`/core/programas/${formulario.id}/`, {
          nombre: formulario.nombre,
          descripcion: formulario.descripcion
        })
        alert("Programa actualizado correctamente")
      } else {
        await api.post("/core/programas/", {
          nombre: formulario.nombre,
          descripcion: formulario.descripcion
        })
        alert("Programa agregado correctamente")
      }

      limpiarFormulario()
      listarProgramas()
    } catch (error) {
      console.error(error)
      alert("Error guardando programa")
    }
  }

  const editarPrograma = (programa) => {
    setFormulario({
      id: programa.id,
      nombre: programa.nombre || "",
      descripcion: programa.descripcion || ""
    })
    setEditando(true)
  }

  const eliminarPrograma = async (id) => {
    const confirmado = window.confirm("¿Desea eliminar este programa de estudio?")
    if (!confirmado) return

    try {
      await api.delete(`/core/programas/${id}/`)
      alert("Programa eliminado correctamente")
      listarProgramas()

      if (formulario.id === id) {
        limpiarFormulario()
      }
    } catch (error) {
      console.error(error)
      alert("Error eliminando programa")
    }
  }

  return (
    <div className="bg-gradient">
      <div className="container">
        <AdminPageHeader
          title="Programas de Estudio"
          subtitle="Administra la base curricular principal del sistema."
        />

        <div className="card">
          <h2>Gestión de Programas de Estudio</h2>

          <form onSubmit={guardarPrograma} className="mt-2">
            <label>Nombre del programa</label>
            <input
              type="text"
              name="nombre"
              value={formulario.nombre}
              onChange={manejarCambio}
              placeholder="Digite el nombre del programa"
            />

            <label>Descripción</label>
            <textarea
              name="descripcion"
              value={formulario.descripcion}
              onChange={manejarCambio}
              placeholder="Digite la descripción"
              rows="4"
            />

            <div className="mt-1" style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="btn-primary">
                {editando ? "Actualizar" : "Guardar"}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={limpiarFormulario}
              >
                Limpiar
              </button>
            </div>
          </form>
        </div>

        <div className="card mt-2">
          <h3>Listado de Programas</h3>

          {cargando ? (
            <p>Cargando programas...</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {programas.length === 0 ? (
                  <tr>
                    <td colSpan="4">No hay programas registrados</td>
                  </tr>
                ) : (
                  programas.map((programa) => (
                    <tr key={programa.id}>
                      <td>{programa.id}</td>
                      <td>{programa.nombre}</td>
                      <td>{programa.descripcion}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className="btn-success"
                            onClick={() => editarPrograma(programa)}
                          >
                            Editar
                          </button>

                          <button
                            className="btn-danger"
                            onClick={() => eliminarPrograma(programa.id)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
