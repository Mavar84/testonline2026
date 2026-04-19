import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import api from "../../services/api"
import AdminPageHeader from "../../components/AdminPageHeader"

export default function PruebaAsignacionesPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [prueba, setPrueba] = useState(null)
  const [estudiantes, setEstudiantes] = useState([])
  const [asignadosIds, setAsignadosIds] = useState([])
  const [busquedaDisponibles, setBusquedaDisponibles] = useState("")
  const [busquedaAsignados, setBusquedaAsignados] = useState("")
  const [seleccionDisponibles, setSeleccionDisponibles] = useState([])
  const [seleccionAsignados, setSeleccionAsignados] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarDatos()
  }, [id])

  const cargarDatos = async () => {
    setCargando(true)
    try {
      const [pruebaRes, estudiantesRes, asignacionesRes] = await Promise.all([
        api.get(`/pruebas/pruebas/${id}/`),
        api.get("/usuarios/estudiantes/"),
        api.get(`/pruebas/pruebas/${id}/asignaciones/`)
      ])

      setPrueba(pruebaRes.data)
      setEstudiantes(estudiantesRes.data)
      setAsignadosIds(asignacionesRes.data.map((item) => item.estudiante))
      setSeleccionDisponibles([])
      setSeleccionAsignados([])
    } catch (error) {
      console.error(error.response?.data || error)
      alert("No se pudo cargar la gestión de asignaciones.")
    } finally {
      setCargando(false)
    }
  }

  const estudiantesDisponibles = useMemo(
    () => estudiantes
      .filter((estudiante) => !asignadosIds.includes(estudiante.usuario_id))
      .filter((estudiante) => {
        const texto = `${estudiante.nombre_completo || ""} ${estudiante.username || ""} ${estudiante.codigo_estudiante || ""}`.toLowerCase()
        return texto.includes(busquedaDisponibles.toLowerCase())
      }),
    [asignadosIds, busquedaDisponibles, estudiantes]
  )

  const estudiantesAsignados = useMemo(
    () => estudiantes
      .filter((estudiante) => asignadosIds.includes(estudiante.usuario_id))
      .filter((estudiante) => {
        const texto = `${estudiante.nombre_completo || ""} ${estudiante.username || ""} ${estudiante.codigo_estudiante || ""}`.toLowerCase()
        return texto.includes(busquedaAsignados.toLowerCase())
      }),
    [asignadosIds, busquedaAsignados, estudiantes]
  )

  const agregarEstudiante = (usuarioId) => {
    setAsignadosIds((prev) => prev.includes(usuarioId) ? prev : [...prev, usuarioId])
  }

  const quitarEstudiante = (usuarioId) => {
    setAsignadosIds((prev) => prev.filter((idActual) => idActual !== usuarioId))
  }

  const toggleSeleccionDisponible = (usuarioId) => {
    setSeleccionDisponibles((prev) =>
      prev.includes(usuarioId)
        ? prev.filter((idActual) => idActual !== usuarioId)
        : [...prev, usuarioId]
    )
  }

  const toggleSeleccionAsignado = (usuarioId) => {
    setSeleccionAsignados((prev) =>
      prev.includes(usuarioId)
        ? prev.filter((idActual) => idActual !== usuarioId)
        : [...prev, usuarioId]
    )
  }

  const agregarSeleccionados = () => {
    setAsignadosIds((prev) => [...new Set([...prev, ...seleccionDisponibles])])
    setSeleccionDisponibles([])
  }

  const quitarSeleccionados = () => {
    setAsignadosIds((prev) => prev.filter((idActual) => !seleccionAsignados.includes(idActual)))
    setSeleccionAsignados([])
  }

  const seleccionarTodosDisponibles = () => {
    setSeleccionDisponibles(estudiantesDisponibles.map((estudiante) => estudiante.usuario_id))
  }

  const seleccionarTodosAsignados = () => {
    setSeleccionAsignados(estudiantesAsignados.map((estudiante) => estudiante.usuario_id))
  }

  const limpiarSeleccionDisponibles = () => setSeleccionDisponibles([])

  const limpiarSeleccionAsignados = () => setSeleccionAsignados([])

  const guardarAsignaciones = async () => {
    setGuardando(true)
    try {
      await api.post(`/pruebas/pruebas/${id}/asignaciones/`, {
        estudiantes: asignadosIds
      })
      alert("Asignaciones guardadas correctamente.")
    } catch (error) {
      console.error(error.response?.data || error)
      alert("No se pudieron guardar las asignaciones.")
    } finally {
      setGuardando(false)
    }
  }

  const renderStudent = (estudiante, variant) => (
    <article className="assignment-student-card" key={estudiante.usuario_id}>
      <label className="assignment-student-main">
        <input
          type="checkbox"
          checked={variant === "disponible"
            ? seleccionDisponibles.includes(estudiante.usuario_id)
            : seleccionAsignados.includes(estudiante.usuario_id)}
          onChange={() => (
            variant === "disponible"
              ? toggleSeleccionDisponible(estudiante.usuario_id)
              : toggleSeleccionAsignado(estudiante.usuario_id)
          )}
        />

        <div>
          <strong>{estudiante.nombre_completo || estudiante.username}</strong>
          <small>{estudiante.username}{estudiante.codigo_estudiante ? ` | ${estudiante.codigo_estudiante}` : ""}</small>
        </div>
      </label>

      <div className="assignment-student-inline-actions">
        {variant === "disponible" ? (
          <button type="button" className="btn-success" onClick={() => agregarEstudiante(estudiante.usuario_id)}>
            Agregar
          </button>
        ) : (
          <button type="button" className="btn-danger" onClick={() => quitarEstudiante(estudiante.usuario_id)}>
            Quitar
          </button>
        )}
      </div>
    </article>
  )

  return (
    <div className="bg-gradient">
      <div className="container">
        <AdminPageHeader
          title="Asignación de Estudiantes"
          subtitle="Agrega o quita estudiantes de la prueba antes de su ejecución."
        />

        <div className="card">
          {cargando && <p>Cargando asignaciones...</p>}

          {!cargando && prueba && (
            <>
              <div className="assignment-header">
                <div>
                  <span className="admin-kicker">Prueba #{prueba.id}</span>
                  <h2>{prueba.asignatura || "Sin asignatura"}</h2>
                  <p>{prueba.nivel || "Nivel no indicado"} | {prueba.periodo || "Periodo no indicado"} | {prueba.puntos_totales || 0} puntos</p>
                </div>

                <div className="assignment-actions">
                  <button type="button" className="btn-secondary" onClick={() => navigate("/admin/pruebas")}>
                    Volver a pruebas
                  </button>
                  <button type="button" className="btn-primary" onClick={guardarAsignaciones} disabled={guardando}>
                    {guardando ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </div>

              <div className="assignment-summary">
                <span><strong>{estudiantesAsignados.length}</strong> asignado(s)</span>
                <span><strong>{estudiantesDisponibles.length}</strong> disponible(s)</span>
              </div>

              <div className="assignment-layout">
                <section className="assignment-column">
                  <div className="assignment-column-head">
                    <h3>Disponibles para asignar</h3>
                    <input
                      value={busquedaDisponibles}
                      onChange={(e) => setBusquedaDisponibles(e.target.value)}
                      placeholder="Buscar estudiante..."
                    />
                  </div>

                  <div className="assignment-bulk-actions">
                    <button type="button" className="btn-secondary" onClick={seleccionarTodosDisponibles}>
                      Seleccionar visibles
                    </button>
                    <button type="button" className="btn-secondary" onClick={limpiarSeleccionDisponibles}>
                      Limpiar
                    </button>
                    <button type="button" className="btn-success" onClick={agregarSeleccionados} disabled={seleccionDisponibles.length === 0}>
                      Agregar seleccionados
                    </button>
                  </div>

                  <div className="assignment-student-list">
                    {estudiantesDisponibles.length === 0 && <p>No hay estudiantes disponibles con ese filtro.</p>}
                    {estudiantesDisponibles.map((estudiante) => renderStudent(estudiante, "disponible"))}
                  </div>
                </section>

                <section className="assignment-column">
                  <div className="assignment-column-head">
                    <h3>Asignados a la prueba</h3>
                    <input
                      value={busquedaAsignados}
                      onChange={(e) => setBusquedaAsignados(e.target.value)}
                      placeholder="Buscar asignado..."
                    />
                  </div>

                  <div className="assignment-bulk-actions">
                    <button type="button" className="btn-secondary" onClick={seleccionarTodosAsignados}>
                      Seleccionar visibles
                    </button>
                    <button type="button" className="btn-secondary" onClick={limpiarSeleccionAsignados}>
                      Limpiar
                    </button>
                    <button type="button" className="btn-danger" onClick={quitarSeleccionados} disabled={seleccionAsignados.length === 0}>
                      Quitar seleccionados
                    </button>
                  </div>

                  <div className="assignment-student-list">
                    {estudiantesAsignados.length === 0 && <p>Aún no hay estudiantes asignados.</p>}
                    {estudiantesAsignados.map((estudiante) => renderStudent(estudiante, "asignado"))}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
