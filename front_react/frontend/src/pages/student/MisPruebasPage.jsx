import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../../services/api"

export default function MisPruebasPage() {
  const navigate = useNavigate()
  const [pruebas, setPruebas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarPruebas()
  }, [])

  const cargarPruebas = async () => {
    try {
      const res = await api.get("/pruebas/pruebas/mis_asignadas/")
      setPruebas(res.data)
    } catch (error) {
      console.error(error.response?.data || error)
    } finally {
      setCargando(false)
    }
  }

  const cerrarSesion = () => {
    localStorage.removeItem("token")
    window.location.href = "/student-login"
  }

  const descripcionAcceso = (prueba) => {
    if (prueba.ya_realizada) {
      return prueba.fecha_entrega
        ? `Ya la entregaste el ${new Date(prueba.fecha_entrega).toLocaleString()}`
        : "Ya realizaste esta prueba"
    }
    if (prueba.acceso_habilitado) return "Disponible ahora"
    if (prueba.mensaje_estado) return prueba.mensaje_estado
    if (prueba.fecha_aplicacion) return `Disponible desde ${new Date(prueba.fecha_aplicacion).toLocaleString()}`
    return "Pendiente de habilitación"
  }

  return (
    <div className="bg-gradient">
      <main className="student-shell">
        <section className="student-hero">
          <div>
            <span className="admin-kicker">Estudiante</span>
            <h1>Mis pruebas asignadas</h1>
            <p>Consulta las evaluaciones que tu profesor te ha habilitado y entra directamente cuando estés listo.</p>
          </div>

          <div className="admin-page-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate("/estudiante/configuracion")}>
              Configuración
            </button>
            <button type="button" className="btn-danger" onClick={cerrarSesion}>
              Cerrar sesión
            </button>
          </div>
        </section>

        <section className="admin-section">
          {cargando && <p>Cargando pruebas...</p>}

          {!cargando && pruebas.length === 0 && (
            <div className="student-empty">
              <h3>Aún no tienes pruebas asignadas</h3>
              <p>Cuando un profesor te asigne una prueba, aparecerá aquí.</p>
            </div>
          )}

          <div className="student-tests-grid">
            {pruebas.map((prueba) => (
              <article className="student-test-card" key={prueba.asignacion_id}>
                <div className="student-test-head">
                  <span className="student-test-tag">{prueba.asignatura || "Sin asignatura"}</span>
                  {prueba.ya_realizada && <span className="student-test-status done">Realizada</span>}
                </div>
                <h3>{prueba.nivel || "Nivel no indicado"}</h3>
                <p>{prueba.centro_educativo || "Centro educativo no indicado"}</p>
                <ul className="student-test-meta">
                  <li><strong>Profesor:</strong> {prueba.profesor}</li>
                  <li><strong>Periodo:</strong> {prueba.periodo || "-"}</li>
                  <li><strong>Puntos:</strong> {prueba.puntos_totales || 0}</li>
                  <li><strong>Duración:</strong> {prueba.duracion_minutos || 60} min</li>
                  <li><strong>Fecha:</strong> {prueba.fecha_aplicacion ? new Date(prueba.fecha_aplicacion).toLocaleString() : "Pendiente"}</li>
                  {prueba.ya_realizada && (
                    <>
                      <li><strong>Nota:</strong> {Number(prueba.nota_obtenida || 0).toFixed(2)}</li>
                      <li><strong>Porcentaje:</strong> {Number(prueba.porcentaje_obtenido || 0).toFixed(2)}%</li>
                    </>
                  )}
                </ul>

                <p>{descripcionAcceso(prueba)}</p>

                {!prueba.ya_realizada ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!prueba.acceso_habilitado}
                    onClick={() => navigate(`/app/prueba/${prueba.prueba_id}`)}
                  >
                    Ingresar a la prueba
                  </button>
                ) : (
                  <div className="student-test-actions">
                    <button type="button" className="btn-secondary" disabled>
                      Prueba ya realizada
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => navigate(`/estudiante/entregas/${prueba.intento_id}`)}
                    >
                      Ver revisión
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
