import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../../services/api"
import PhotoCaptureInput from "../../components/PhotoCaptureInput"

const estadoInicial = {
  current_password: "",
  new_password: "",
  confirm_password: "",
  foto_estudiante: ""
}

export default function StudentConfiguracionPage() {
  const navigate = useNavigate()
  const [formulario, setFormulario] = useState(estadoInicial)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    cargarPerfil()
  }, [])

  const cargarPerfil = async () => {
    try {
      const res = await api.get("/usuarios/mi-perfil/")
      setPerfil(res.data)
      setFormulario((prev) => ({
        ...prev,
        foto_estudiante: ""
      }))
    } catch (requestError) {
      console.error(requestError.response?.data || requestError)
      setError("No se pudo cargar tu perfil.")
    } finally {
      setCargando(false)
    }
  }

  const actualizar = (campo, valor) => {
    setFormulario((prev) => ({ ...prev, [campo]: valor }))
  }

  const cerrarSesion = () => {
    localStorage.removeItem("token")
    window.location.href = "/student-login"
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError("")

    const quiereCambiarClave = Boolean(formulario.current_password || formulario.new_password || formulario.confirm_password)
    const quiereCambiarFoto = Boolean(formulario.foto_estudiante)

    if (!quiereCambiarClave && !quiereCambiarFoto) {
      setError("Haz al menos un cambio antes de guardar.")
      return
    }

    if (quiereCambiarClave && formulario.new_password !== formulario.confirm_password) {
      setError("La confirmación de la nueva clave no coincide.")
      return
    }

    setGuardando(true)
    try {
      const payload = {}
      if (quiereCambiarClave) {
        payload.current_password = formulario.current_password
        payload.new_password = formulario.new_password
        payload.confirm_password = formulario.confirm_password
      }
      if (quiereCambiarFoto) {
        payload.foto_estudiante = formulario.foto_estudiante
      }

      await api.post("/usuarios/configuracion/", payload)
      localStorage.removeItem("token")
      window.alert("La configuración se actualizó correctamente. Debes volver a iniciar sesión.")
      window.location.href = "/student-login"
    } catch (requestError) {
      console.error(requestError.response?.data || requestError)
      const data = requestError.response?.data
      setError(
        data?.current_password?.[0]
          || data?.confirm_password?.[0]
          || data?.new_password?.[0]
          || data?.foto_estudiante?.[0]
          || data?.non_field_errors?.[0]
          || data?.detail
          || "No se pudo actualizar la configuración."
      )
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="bg-gradient center">
        <div className="card"><p>Cargando configuración...</p></div>
      </div>
    )
  }

  return (
    <div className="bg-gradient">
      <main className="student-shell">
        <section className="student-hero">
          <div>
            <span className="admin-kicker">Estudiante</span>
            <h1>Configuración</h1>
            <p>Actualiza tu clave y, si lo necesitas, toma una nueva foto de referencia para el ingreso.</p>
          </div>

          <div className="admin-page-actions">
            <button type="button" className="btn-secondary" onClick={() => navigate("/estudiante/pruebas")}>
              Mis pruebas
            </button>
            <button type="button" className="btn-danger" onClick={cerrarSesion}>
              Cerrar sesión
            </button>
          </div>
        </section>

        <section className="admin-section settings-layout">
          <div className="card settings-card">
            <form onSubmit={guardar} className="settings-form">
              <div className="section-heading">
                <h2>Clave de acceso</h2>
                <p>Si la vas a cambiar, escribe la actual y confirma la nueva clave dos veces.</p>
              </div>

              <div className="settings-grid">
                <div>
                  <label>Clave actual</label>
                  <input
                    type="password"
                    value={formulario.current_password}
                    onChange={(e) => actualizar("current_password", e.target.value)}
                  />
                </div>
                <div>
                  <label>Nueva clave</label>
                  <input
                    type="password"
                    value={formulario.new_password}
                    onChange={(e) => actualizar("new_password", e.target.value)}
                  />
                </div>
                <div>
                  <label>Confirmar nueva clave</label>
                  <input
                    type="password"
                    value={formulario.confirm_password}
                    onChange={(e) => actualizar("confirm_password", e.target.value)}
                  />
                </div>
              </div>

              <div className="section-heading mt-2">
                <h2>Foto de acceso</h2>
                <p>Tu foto actual queda abajo como referencia. Si tomas una nueva, reemplazará la anterior.</p>
              </div>

              <div className="student-photo-columns">
                <div className="student-photo-reference">
                  <label>Foto actual</label>
                  <div className="student-photo-box">
                    {perfil?.tiene_foto_estudiante ? (
                      <img src={perfil.foto_estudiante || ""} alt={perfil.nombre_completo || perfil.username} />
                    ) : (
                      <div className="photo-placeholder"><span>No hay foto guardada</span></div>
                    )}
                  </div>
                </div>

                <PhotoCaptureInput
                  value={formulario.foto_estudiante}
                  onChange={(value) => actualizar("foto_estudiante", value)}
                  label="Nueva foto"
                  helpText="Usa una toma reciente, frontal y con buena luz."
                  allowUpload={false}
                />
              </div>

              {error && <p className="auth-error">{error}</p>}

              <div className="settings-actions">
                <button type="submit" className="btn-primary" disabled={guardando}>
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}
