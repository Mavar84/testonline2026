import { useState } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"

export default function Login() {
  const [usuario, setUsuario] = useState("")
  const [clave, setClave] = useState("")
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const login = async (e) => {
    e.preventDefault()
    setCargando(true)
    setError("")
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/token/", {
        username: usuario,
        password: clave
      })

      localStorage.setItem("token", res.data.access)
      navigate("/admin")

    } catch (error) {
      setError("No se pudo iniciar sesión como profesor.")
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="bg-gradient-soft auth-shell">
      <section className="auth-hero">
        <div className="auth-hero-copy">
          <span className="admin-kicker">Plataforma de evaluación</span>
          <h1>Ingreso principal</h1>
          <p>
            Administra pruebas, banco de ítems y asignaciones desde un acceso claro para docentes,
            con una entrada separada para estudiantes.
          </p>
        </div>

        <div className="auth-role-grid">
          <button type="button" className="auth-role-card active" onClick={() => navigate("/")}>
            <strong>Profesorado</strong>
            <small>Crear pruebas, asignar estudiantes y administrar contenido.</small>
          </button>
          <button type="button" className="auth-role-card" onClick={() => navigate("/student-login")}>
            <strong>Estudiantes</strong>
            <small>Entrar a las pruebas asignadas y revisar su bandeja personal.</small>
          </button>
        </div>
      </section>

      <div className="auth-panel">
        <div className="card auth-card">
          <div className="auth-card-head">
            <h2>Ingreso de profesor</h2>
            <p>Usa tu cuenta docente para acceder al panel administrativo.</p>
          </div>

          <form onSubmit={login}>
            <label>Usuario</label>
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Tu usuario"
            />

            <label>Contraseña</label>
            <input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Tu contraseña"
            />

            {error && <p className="auth-error">{error}</p>}

            <button className="btn-primary" disabled={cargando}>
              {cargando ? "Ingresando..." : "Ingresar al panel"}
            </button>
          </form>
        </div>

        <aside className="card auth-sidecard">
          <h3>Accesos rápidos</h3>
          <button className="btn-secondary" onClick={() => navigate("/student-login")}>
            Ingresar como estudiante
          </button>
          <button className="btn-secondary" onClick={() => navigate("/registro-estudiante")}>
            Registrarme como estudiante
          </button>
        </aside>
      </div>
    </div>
  )
}
