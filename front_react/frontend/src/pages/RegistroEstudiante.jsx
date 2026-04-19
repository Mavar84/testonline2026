import { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import PhotoCaptureInput from "../components/PhotoCaptureInput"

export default function RegistroEstudiante() {
  const navigate = useNavigate()
  const [formulario, setFormulario] = useState({
    nombre_completo: "",
    username: "",
    email: "",
    codigo_estudiante: "",
    password: "",
    foto_estudiante: ""
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const actualizarCampo = (name, value) => {
    setFormulario((prev) => ({ ...prev, [name]: value }))
  }

  const registrar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError("")
    try {
      await axios.post("http://127.0.0.1:8000/api/usuarios/registro-estudiante/", formulario)
      alert("Registro completado. Ahora puedes iniciar sesión.")
      navigate("/student-login")
    } catch (error) {
      console.error(error.response?.data || error)
      setError("No se pudo completar el registro con esos datos.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="bg-gradient-soft auth-shell">
      <section className="auth-hero student-auth-hero">
        <div className="auth-hero-copy">
          <span className="admin-kicker">Registro de estudiante</span>
          <h1>Crea tu cuenta</h1>
          <p>
            Una vez registrado, tu profesor podrá encontrarte en la lista de estudiantes y asignarte pruebas.
          </p>
        </div>

        <div className="auth-role-grid">
          <button type="button" className="auth-role-card active" onClick={() => navigate("/registro-estudiante")}>
            <strong>Nueva cuenta</strong>
            <small>Completa tus datos y queda disponible para asignaciones.</small>
          </button>
          <button type="button" className="auth-role-card" onClick={() => navigate("/student-login")}>
            <strong>Ya tengo cuenta</strong>
            <small>Volver al ingreso de estudiante.</small>
          </button>
        </div>
      </section>

      <div className="auth-panel single">
        <div className="card auth-card register-card">
          <div className="auth-card-head">
            <h2>Registro de estudiante</h2>
            <p>Completa la información básica para aparecer en la lista del profesor.</p>
          </div>

          <form onSubmit={registrar}>
            <div className="auth-form-grid">
              <div>
                <label>Nombre completo</label>
                <input value={formulario.nombre_completo} onChange={(e) => actualizarCampo("nombre_completo", e.target.value)} required />
              </div>

              <div>
                <label>Usuario</label>
                <input value={formulario.username} onChange={(e) => actualizarCampo("username", e.target.value)} required />
              </div>

              <div>
                <label>Correo electrónico</label>
                <input type="email" value={formulario.email} onChange={(e) => actualizarCampo("email", e.target.value)} />
              </div>

              <div>
                <label>Código de estudiante</label>
                <input value={formulario.codigo_estudiante} onChange={(e) => actualizarCampo("codigo_estudiante", e.target.value)} />
              </div>
            </div>

            <PhotoCaptureInput
              value={formulario.foto_estudiante}
              onChange={(value) => actualizarCampo("foto_estudiante", value)}
              label="Foto del estudiante"
              helpText="Toma la foto con la cámara. Se usará como referencia para el ingreso facial."
              allowUpload={false}
            />

            <label>Contraseña</label>
            <input type="password" value={formulario.password} onChange={(e) => actualizarCampo("password", e.target.value)} required />

            {error && <p className="auth-error">{error}</p>}

            <button className="btn-primary" disabled={guardando}>
              {guardando ? "Creando cuenta..." : "Crear cuenta"}
            </button>

            <div className="auth-actions-stack">
              <button type="button" className="btn-secondary" onClick={() => navigate("/student-login")}>
                Ya tengo cuenta
              </button>

              <button type="button" className="btn-secondary" onClick={() => navigate("/")}>
                Volver al ingreso principal
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
