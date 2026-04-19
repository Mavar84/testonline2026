import { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import LiveFaceVerifier from "../components/LiveFaceVerifier"

export default function StudentLogin() {
  const [usuario, setUsuario] = useState("")
  const [clave, setClave] = useState("")
  const [preloginToken, setPreloginToken] = useState("")
  const [paso, setPaso] = useState("credenciales")
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const continuarConCredenciales = async (e) => {
    e.preventDefault()
    const usuarioLimpio = usuario.trim()
    if (!usuarioLimpio || !clave) {
      setError("Escribe tu usuario y contraseña para continuar.")
      return
    }

    setCargando(true)
    setError("")
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/usuarios/prelogin-estudiante/", {
        username: usuarioLimpio,
        password: clave
      })

      setPreloginToken(res.data.prelogin_token)
      setPaso("face")
    } catch (error) {
      setError(error.response?.data?.detail || "No se pudo validar usuario y clave.")
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="bg-gradient-soft auth-shell">
      <section className="auth-hero student-auth-hero">
        <div className="auth-hero-copy">
          <span className="admin-kicker">Acceso de estudiante</span>
          <h1>Tus pruebas en un solo lugar</h1>
          <p>
            Entra con tu cuenta para ver las evaluaciones que te asignaron y comenzar en cuanto estén disponibles.
          </p>
        </div>

        <div className="auth-role-grid">
          <button type="button" className="auth-role-card" onClick={() => navigate("/")}>
            <strong>Profesorado</strong>
            <small>Volver al acceso administrativo del sistema.</small>
          </button>
          <button type="button" className="auth-role-card active" onClick={() => navigate("/student-login")}>
            <strong>Estudiantes</strong>
            <small>Entrar a la bandeja personal de pruebas asignadas.</small>
          </button>
        </div>
      </section>

      <div className="auth-panel single">
        <div className="card auth-card student-login-card">
          <div className="auth-card-head">
            <h2>Ingreso de estudiante</h2>
            <p>Primero validamos tu usuario y clave, y luego confirmamos tu identidad con cámara.</p>
          </div>

          <div className="auth-step-list">
            <span className={paso === "credenciales" ? "auth-step-chip active" : "auth-step-chip"}>1. Usuario</span>
            <span className={paso === "credenciales" ? "auth-step-chip active" : "auth-step-chip"}>2. Clave</span>
            <span className={paso === "face" ? "auth-step-chip active" : "auth-step-chip"}>3. Foto en vivo</span>
          </div>

          {paso === "credenciales" ? (
            <form onSubmit={continuarConCredenciales}>
              <label>Usuario</label>
              <input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Tu usuario" required />

                <label>Contraseña</label>
                <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Tu contraseña" required />

              {error && <p className="auth-error">{error}</p>}

              <button className="btn-primary" disabled={cargando}>
                {cargando ? "Validando..." : "Continuar a verificación facial"}
              </button>

              <div className="auth-actions-stack">
                <button type="button" className="btn-secondary" onClick={() => navigate("/registro-estudiante")}>
                  Registrarme como estudiante
                </button>

                <button type="button" className="btn-secondary" onClick={() => navigate("/")}>
                  Volver al ingreso principal
                </button>
              </div>
            </form>
          ) : (
            <LiveFaceVerifier
              username={usuario.trim()}
              preloginToken={preloginToken}
              onSuccess={(data) => {
                localStorage.setItem("token", data.access)
                navigate("/estudiante/pruebas")
              }}
              onCancel={() => {
                setPaso("credenciales")
                setPreloginToken("")
                setError("")
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
