import { useNavigate } from "react-router-dom"

const accesos = [
  {
    titulo: "Programas MEP",
    descripcion: "Base curricular principal para organizar todo el contenido.",
    ruta: "/admin/programas",
    inicial: "PE",
    color: "blue"
  },
  {
    titulo: "Subáreas",
    descripcion: "Clasifica los programas en áreas de trabajo específicas.",
    ruta: "/admin/subareas",
    inicial: "SA",
    color: "green"
  },
  {
    titulo: "Subtemas",
    descripcion: "Define unidades de contenido para asociar resultados.",
    ruta: "/admin/subtemas",
    inicial: "ST",
    color: "slate"
  },
  {
    titulo: "Resultados",
    descripcion: "Administra resultados de aprendizaje para clasificar ítems.",
    ruta: "/admin/resultados",
    inicial: "RA",
    color: "indigo"
  },
  {
    titulo: "Selección Única",
    descripcion: "Crea ítems con opciones, respuesta correcta y documentos.",
    ruta: "/admin/items-seleccion",
    inicial: "SU",
    color: "orange"
  },
  {
    titulo: "Respuesta Única",
    descripcion: "Crea ítems abiertos con una o varias respuestas esperadas.",
    ruta: "/admin/items-respuesta",
    inicial: "RU",
    color: "red"
  },
  {
    titulo: "Identificación",
    descripcion: "Crea ítems visuales con pines y respuestas por componente.",
    ruta: "/admin/items-identificacion",
    inicial: "ID",
    color: "teal"
  },
          {
            titulo: "Pruebas",
            descripcion: "Arma evaluaciones por partes, tipo de ítem y puntaje total.",
            ruta: "/admin/pruebas",
            inicial: "PR",
            color: "cyan"
          },
          {
            titulo: "Configuración",
            descripcion: "Actualiza tu clave de acceso y protege tu cuenta de profesor.",
            ruta: "/admin/configuracion",
            inicial: "CF",
            color: "violet"
          },
          {
            titulo: "Pareo",
            descripcion: "Construye asociaciones correctas entre elementos y respuestas.",
    ruta: "/admin/items-pareo",
    inicial: "PA",
    color: "rose"
  }
]

const pendientes = [
  {
    titulo: "Banco de Ítems",
    descripcion: "Vista consolidada pendiente para agrupar todos los tipos.",
    ruta: "/admin/items"
  }
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const cerrarSesion = () => {
    localStorage.removeItem("token")
    window.location.href = "/"
  }

  return (
    <div className="bg-gradient">
      <main className="admin-shell">
        <section className="admin-hero">
          <div className="admin-hero-top">
            <div>
              <span className="admin-kicker">Sistema de evaluación</span>
              <h1>Panel Administrativo</h1>
              <p>
                Gestiona la estructura curricular, el banco de ítems y los recursos
                que alimentan las pruebas en línea.
              </p>
            </div>

            <button type="button" className="btn-danger" onClick={cerrarSesion}>
              Cerrar sesión
            </button>
          </div>
        </section>

        <section className="admin-section">
          <div className="section-heading">
            <h2>Módulos principales</h2>
            <p>Accesos directos a las áreas que ya están disponibles.</p>
          </div>

          <div className="admin-grid">
            {accesos.map((acceso) => (
              <button
                type="button"
                className="admin-module"
                key={acceso.ruta}
                onClick={() => navigate(acceso.ruta)}
              >
                <span className={`module-icon module-${acceso.color}`}>
                  {acceso.inicial}
                </span>
                <span>
                  <strong>{acceso.titulo}</strong>
                  <small>{acceso.descripcion}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="admin-section compact">
          <div className="section-heading">
            <h2>Próximos módulos</h2>
            <p>Rutas preparadas para continuar el crecimiento del sistema.</p>
          </div>

          <div className="admin-pending-grid">
            {pendientes.map((item) => (
              <button
                type="button"
                className="admin-pending"
                key={item.ruta}
                onClick={() => navigate(item.ruta)}
              >
                <strong>{item.titulo}</strong>
                <small>{item.descripcion}</small>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
