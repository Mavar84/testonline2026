import { Routes, Route } from "react-router-dom"
import Login from "../pages/Login"
import RegistroEstudiante from "../pages/RegistroEstudiante"
import StudentLogin from "../pages/StudentLogin"
import Dashboard from "../pages/Dashboard"



// ADMIN
import AdminDashboard from "../pages/admin/AdminDashboard"

// APP (estudiante)
import MisPruebasPage from "../pages/student/MisPruebasPage"
import StudentEntregaDetallePage from "../pages/student/StudentEntregaDetallePage"
import ResolverPrueba from "../pages/app/ResolverPrueba"
import ProgramasPage from "../pages/admin/ProgramasPage"
import SubAreasPage from "../pages/admin/SubAreasPage"
import ResultadosPage from "../pages/admin/ResultadosPage"
import SubtemasPage from "../pages/admin/SubtemasPage"
import ItemSeleccionUnicaPage from "../pages/admin/ItemSeleccionUnicaPage"
import ItemSeleccionDocumentosPage from "../pages/admin/ItemSeleccionDocumentosPage"
import ItemRespuestaUnicaPage from "../pages/admin/ItemRespuestaUnicaPage"
import ItemRespuestaDocumentosPage from "../pages/admin/ItemRespuestaDocumentosPage"
import ItemIdentificacionPage from "../pages/admin/ItemIdentificacionPage"
import ItemIdentificacionDocumentosPage from "../pages/admin/ItemIdentificacionDocumentosPage"
import ItemPareoPage from "../pages/admin/ItemPareoPage"
import ItemPareoDocumentosPage from "../pages/admin/ItemPareoDocumentosPage"
import PruebasPage from "../pages/admin/PruebasPage"
import PruebaAsignacionesPage from "../pages/admin/PruebaAsignacionesPage"
import PruebaEntregasPage from "../pages/admin/PruebaEntregasPage"
import ProfesorConfiguracionPage from "../pages/admin/ProfesorConfiguracionPage"
import StudentConfiguracionPage from "../pages/student/StudentConfiguracionPage"
export default function AppRoutes() {
  return (
    <Routes>

      {/* LOGIN */}
      <Route path="/" element={<Login />} />
      <Route path="/student-login" element={<StudentLogin />} />
      <Route path="/registro-estudiante" element={<RegistroEstudiante />} />

      {/* ADMIN */}
      <Route path="/admin" element={<AdminDashboard />} />

      {/* ESTUDIANTE */}
      <Route path="/estudiante/pruebas" element={<MisPruebasPage />} />
      <Route path="/estudiante/entregas/:intentoId" element={<StudentEntregaDetallePage />} />
      <Route path="/estudiante/configuracion" element={<StudentConfiguracionPage />} />
      <Route path="/app/prueba/:id" element={<ResolverPrueba />} />
        <Route path="/admin/programas" element={<ProgramasPage />} />
        <Route path="/admin/subareas" element={<SubAreasPage />} />
        <Route path="/admin/resultados" element={<ResultadosPage />} />
        <Route path="/admin/subtemas" element={<SubtemasPage />} />
        <Route path="/admin/items-seleccion" element={<ItemSeleccionUnicaPage />} />
        <Route path="/admin/items-seleccion/:id/documentos" element={<ItemSeleccionDocumentosPage />} />
        <Route path="/admin/items-respuesta" element={<ItemRespuestaUnicaPage />} />
        <Route path="/admin/items-respuesta/:id/documentos" element={<ItemRespuestaDocumentosPage />} />
        <Route path="/admin/items-identificacion" element={<ItemIdentificacionPage />} />
        <Route path="/admin/items-identificacion/:id/documentos" element={<ItemIdentificacionDocumentosPage />} />
        <Route path="/admin/items-pareo" element={<ItemPareoPage />} />
        <Route path="/admin/items-pareo/:id/documentos" element={<ItemPareoDocumentosPage />} />
        <Route path="/admin/pruebas" element={<PruebasPage />} />
        <Route path="/admin/pruebas/:id/asignaciones" element={<PruebaAsignacionesPage />} />
        <Route path="/admin/pruebas/:id/entregas" element={<PruebaEntregasPage />} />
        <Route path="/admin/configuracion" element={<ProfesorConfiguracionPage />} />
    </Routes>
  )
}
