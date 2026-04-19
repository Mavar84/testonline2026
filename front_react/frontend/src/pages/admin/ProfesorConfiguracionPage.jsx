import { useState } from "react"
import AdminPageHeader from "../../components/AdminPageHeader"
import api from "../../services/api"

const estadoInicial = {
  current_password: "",
  new_password: "",
  confirm_password: ""
}

export default function ProfesorConfiguracionPage() {
  const [formulario, setFormulario] = useState(estadoInicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const actualizar = (campo, valor) => {
    setFormulario((prev) => ({ ...prev, [campo]: valor }))
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError("")

    if (!formulario.current_password || !formulario.new_password || !formulario.confirm_password) {
      setError("Completa la clave actual, la nueva clave y su confirmación.")
      return
    }

    if (formulario.new_password !== formulario.confirm_password) {
      setError("La confirmación de la nueva clave no coincide.")
      return
    }

    setGuardando(true)
    try {
      await api.post("/usuarios/configuracion/", formulario)
      localStorage.removeItem("token")
      window.alert("La configuración se actualizó correctamente. Debes volver a iniciar sesión.")
      window.location.href = "/"
    } catch (requestError) {
      console.error(requestError.response?.data || requestError)
      const data = requestError.response?.data
      setError(
        data?.current_password?.[0]
          || data?.confirm_password?.[0]
          || data?.new_password?.[0]
          || data?.non_field_errors?.[0]
          || data?.detail
          || "No se pudo actualizar la configuración."
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="bg-gradient">
      <div className="container">
        <AdminPageHeader
          title="Configuración"
          subtitle="Cambia tu clave de acceso. Al guardar, la sesión actual se cerrará para proteger la cuenta."
        />

        <div className="card settings-card">
          <form onSubmit={guardar} className="settings-form">
            <div className="section-heading">
              <h2>Clave de acceso</h2>
              <p>Escribe la clave actual y confirma la nueva dos veces antes de guardar.</p>
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

            {error && <p className="auth-error">{error}</p>}

            <div className="settings-actions">
              <button type="submit" className="btn-primary" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
