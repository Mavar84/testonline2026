import { useNavigate } from "react-router-dom"

export default function AdminPageHeader({ title, subtitle }) {
  const navigate = useNavigate()
  const cerrarSesion = () => {
    localStorage.removeItem("token")
    window.location.href = "/"
  }

  return (
    <div className="admin-page-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="admin-page-actions">
        <button type="button" className="btn-secondary" onClick={() => navigate("/admin/configuracion")}>
          Configuración
        </button>
        <button type="button" className="btn-secondary" onClick={() => navigate("/admin")}>
          Menú principal
        </button>
        <button type="button" className="btn-danger" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
