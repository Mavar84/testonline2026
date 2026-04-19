import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import api from "../../services/api"
import AdminPageHeader from "../../components/AdminPageHeader"

const tipoOpciones = [
  { value: "seleccion", label: "Selección única" },
  { value: "respuesta", label: "Respuesta única" },
  { value: "identificacion", label: "Identificación" },
  { value: "pareo", label: "Pareo" }
]

const tipoLabels = Object.fromEntries(tipoOpciones.map((tipo) => [tipo.value, tipo.label]))

const partesEndpoint = "/pruebas/pruebas-partes/"
const endpointsPorTipo = {
  seleccion: "/pruebas/pruebas-items-seleccion/",
  respuesta: "/pruebas/pruebas-items-respuesta/",
  identificacion: "/pruebas/pruebas-items-identificacion/",
  pareo: "/pruebas/pruebas-items-pareo/"
}

const crearParte = (overrides = {}) => ({
  id: crypto.randomUUID(),
  backendId: null,
  nombre: "",
  tipo: "seleccion",
  cantidad: 1,
  puntajeObjetivo: 1,
  modoRespuesta: "uno",
  busqueda: "",
  items: [],
  ...overrides
})

const crearEstadoInicial = () => ({
  centro_educativo: "",
  asignatura: "",
  periodo: "",
  nivel: "",
  fecha_aplicacion: "",
  duracion_minutos: "60",
  partes: [crearParte()]
})

const toNumber = (value) => Number.parseFloat(value || 0)

const normalizarFechaInput = (value) => {
  if (!value) return ""
  const fecha = new Date(value)
  if (Number.isNaN(fecha.getTime())) return ""
  const ajustada = new Date(fecha.getTime() - (fecha.getTimezoneOffset() * 60000))
  return ajustada.toISOString().slice(0, 16)
}

const serializarFechaLocal = (value) => {
  if (!value) return null
  const fecha = new Date(value)
  if (Number.isNaN(fecha.getTime())) return null
  return fecha.toISOString()
}

const crearLookupCatalogos = (catalogos) => ({
  seleccion: new Map(catalogos.seleccion.map((item) => [item.id, item])),
  respuesta: new Map(catalogos.respuesta.map((item) => [item.id, item])),
  identificacion: new Map(catalogos.identificacion.map((item) => [item.id, item])),
  pareo: new Map(catalogos.pareo.map((item) => [item.id, item]))
})

const construirItemSeleccionado = (tipo, relacion, lookupCatalogos) => {
  const base = lookupCatalogos[tipo]?.get(relacion.item) || {}
  return {
    uid: crypto.randomUUID(),
    itemId: relacion.item,
    enunciado: base.enunciado || `Ítem ${relacion.item}`,
    resumen: base.resumen || base.enunciado || `Ítem ${relacion.item}`,
    puntaje: String(relacion.puntaje ?? "1.00")
  }
}

const construirParteGuardada = (parte, relaciones, lookupCatalogos) => {
  const items = relaciones
    .sort((a, b) => (a.orden || 0) - (b.orden || 0))
    .map((relacion) => construirItemSeleccionado(parte.tipo, relacion, lookupCatalogos))

  return crearParte({
    backendId: parte.id,
    nombre: parte.nombre || `Parte ${parte.orden}`,
    tipo: parte.tipo,
    cantidad: String(parte.cantidad_requerida || items.length || 1),
    puntajeObjetivo: String(parte.puntaje_objetivo ?? (items.reduce((acc, item) => acc + toNumber(item.puntaje), 0) || 1)),
    modoRespuesta: parte.tipo === "respuesta" ? (parte.modo_respuesta || "uno") : "uno",
    items
  })
}

const construirPartesLegadas = (relacionesPorTipo, lookupCatalogos) => {
  return Object.entries(relacionesPorTipo)
    .filter(([, relaciones]) => relaciones.length)
    .map(([tipo, relaciones], index) => {
      const items = relaciones
        .sort((a, b) => (a.orden || 0) - (b.orden || 0))
        .map((relacion) => construirItemSeleccionado(tipo, relacion, lookupCatalogos))

      const todosValenUno = items.every((item) => Math.abs(toNumber(item.puntaje) - 1) < 0.001)
      return crearParte({
        nombre: `Parte ${index + 1} - ${tipoLabels[tipo]}`,
        tipo,
        cantidad: String(items.length || 1),
        puntajeObjetivo: String(items.reduce((acc, item) => acc + toNumber(item.puntaje), 0) || 1),
        modoRespuesta: tipo === "respuesta" && !todosValenUno ? "manual" : "uno",
        items
      })
    })
}

export default function PruebasPage() {
  const navigate = useNavigate()
  const [formulario, setFormulario] = useState(crearEstadoInicial)
  const [catalogos, setCatalogos] = useState({
    seleccion: [],
    respuesta: [],
    identificacion: [],
    pareo: []
  })
  const [pruebas, setPruebas] = useState([])
  const [filtros, setFiltros] = useState({ profesor: "", materia: "" })
  const [detallePrueba, setDetallePrueba] = useState({})
  const [cargandoDetalle, setCargandoDetalle] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)

  useEffect(() => {
    cargarCatalogos()
    cargarPruebas()
  }, [])

  const cargarCatalogos = async () => {
    const [
      seleccionRes,
      respuestaRes,
      identificacionRes,
      identificacionComponentesRes,
      pareoRes,
      pareoDetallesRes,
      pareoRelacionesRes
    ] = await Promise.all([
      api.get("/items/seleccion-unica/"),
      api.get("/items/respuesta-unica/"),
      api.get("/items/identificacion/"),
      api.get("/items/identificacion-componentes/"),
      api.get("/items/pareo/"),
      api.get("/items/pareo-detalles/"),
      api.get("/items/pareo-relaciones/")
    ])

    const identificacion = identificacionRes.data.map((item) => ({
      ...item,
      resumen: `${item.enunciado} (${identificacionComponentesRes.data.filter((comp) => comp.item === item.id).length} pines)`
    }))

    const pareo = pareoRes.data.map((item) => {
      const detalles = pareoDetallesRes.data.filter((detalle) => detalle.encabezado === item.id)
      const detalleIds = new Set(detalles.map((detalle) => detalle.id))
      const relaciones = pareoRelacionesRes.data.filter(
        (relacion) => detalleIds.has(relacion.item_izquierda) && detalleIds.has(relacion.item_derecha)
      )

      return {
        ...item,
        resumen: `${item.enunciado} (${relaciones.length} pareos)`
      }
    })

    setCatalogos({
      seleccion: seleccionRes.data.map((item) => ({ ...item, resumen: item.enunciado })),
      respuesta: respuestaRes.data.map((item) => ({ ...item, resumen: item.enunciado })),
      identificacion,
      pareo
    })
  }

  const cargarPruebas = async () => {
    const res = await api.get("/pruebas/pruebas/")
    setPruebas(res.data)
  }

  const cargarEstructuraPrueba = async (pruebaId) => {
    const [partesRes, seleccionRes, respuestaRes, identificacionRes, pareoRes] = await Promise.all([
      api.get(partesEndpoint),
      api.get(endpointsPorTipo.seleccion),
      api.get(endpointsPorTipo.respuesta),
      api.get(endpointsPorTipo.identificacion),
      api.get(endpointsPorTipo.pareo)
    ])

    return {
      partes: partesRes.data.filter((parte) => parte.prueba === pruebaId).sort((a, b) => (a.orden || 0) - (b.orden || 0)),
      relaciones: {
        seleccion: seleccionRes.data.filter((relacion) => relacion.prueba === pruebaId),
        respuesta: respuestaRes.data.filter((relacion) => relacion.prueba === pruebaId),
        identificacion: identificacionRes.data.filter((relacion) => relacion.prueba === pruebaId),
        pareo: pareoRes.data.filter((relacion) => relacion.prueba === pruebaId)
      }
    }
  }

  const cargarPruebaParaEdicion = async (pruebaId) => {
    try {
      const [pruebaRes, estructura] = await Promise.all([
        api.get(`/pruebas/pruebas/${pruebaId}/`),
        cargarEstructuraPrueba(pruebaId)
      ])

      const prueba = pruebaRes.data
      const lookupCatalogos = crearLookupCatalogos(catalogos)
      const partes = estructura.partes.length
        ? estructura.partes.map((parte) => {
            const relaciones = estructura.relaciones[parte.tipo]?.filter((relacion) => relacion.parte === parte.id) || []
            return construirParteGuardada(parte, relaciones, lookupCatalogos)
          })
        : construirPartesLegadas(estructura.relaciones, lookupCatalogos)

      setFormulario({
        centro_educativo: prueba.centro_educativo || "",
        asignatura: prueba.asignatura || "",
        periodo: prueba.periodo || "",
        nivel: prueba.nivel || "",
        fecha_aplicacion: normalizarFechaInput(prueba.fecha_aplicacion),
        duracion_minutos: String(prueba.duracion_minutos || 60),
        partes: partes.length ? partes : [crearParte()]
      })
      setEditandoId(pruebaId)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (error) {
      console.error(error.response?.data || error)
      alert("No se pudo cargar la prueba para edición.")
    }
  }

  const limpiarEstructuraPrueba = async (pruebaId) => {
    const estructura = await cargarEstructuraPrueba(pruebaId)

    for (const tipo of Object.keys(endpointsPorTipo)) {
      for (const relacion of estructura.relaciones[tipo]) {
        await api.delete(`${endpointsPorTipo[tipo]}${relacion.id}/`)
      }
    }

    for (const parte of estructura.partes) {
      await api.delete(`${partesEndpoint}${parte.id}/`)
    }
  }

  const reiniciarFormulario = () => {
    setFormulario(crearEstadoInicial())
    setEditandoId(null)
  }

  const actualizarGeneral = (name, value) => {
    setFormulario((prev) => ({ ...prev, [name]: value }))
  }

  const actualizarParte = (id, field, value) => {
    setFormulario((prev) => ({
      ...prev,
      partes: prev.partes.map((parte) => {
        if (parte.id !== id) return parte

        const siguiente = { ...parte, [field]: value }

        if (field === "tipo") {
          siguiente.items = []
          siguiente.busqueda = ""
          if (value !== "respuesta") {
            siguiente.modoRespuesta = "uno"
          }
        }

        if (field === "modoRespuesta" && value === "uno") {
          siguiente.items = siguiente.items.map((item) => ({ ...item, puntaje: "1.00" }))
          siguiente.puntajeObjetivo = String(siguiente.items.length || siguiente.cantidad || 1)
        }

        return siguiente
      })
    }))
  }

  const agregarParte = () => {
    setFormulario((prev) => ({ ...prev, partes: [...prev.partes, crearParte()] }))
  }

  const eliminarParte = (id) => {
    setFormulario((prev) => {
      const siguientes = prev.partes.filter((parte) => parte.id !== id)
      return { ...prev, partes: siguientes.length ? siguientes : [crearParte()] }
    })
  }

  const idsUsadosPorTipo = useMemo(() => {
    const usados = {
      seleccion: new Set(),
      respuesta: new Set(),
      identificacion: new Set(),
      pareo: new Set()
    }

    formulario.partes.forEach((parte) => {
      parte.items.forEach((item) => usados[parte.tipo]?.add(item.itemId))
    })

    return usados
  }, [formulario.partes])

  const agregarItemAParte = (parteId, item) => {
    setFormulario((prev) => ({
      ...prev,
      partes: prev.partes.map((parte) => {
        if (parte.id !== parteId) return parte
        if (parte.items.some((actual) => actual.itemId === item.id)) return parte

        const puntajeBase = parte.tipo === "respuesta" && parte.modoRespuesta === "manual"
          ? (parte.items[0]?.puntaje || "1.00")
          : "1.00"

        return {
          ...parte,
          items: [
            ...parte.items,
            {
              uid: crypto.randomUUID(),
              itemId: item.id,
              enunciado: item.enunciado,
              resumen: item.resumen,
              puntaje: puntajeBase
            }
          ]
        }
      })
    }))
  }

  const quitarItemDeParte = (parteId, uid) => {
    setFormulario((prev) => ({
      ...prev,
      partes: prev.partes.map((parte) => (
        parte.id === parteId
          ? { ...parte, items: parte.items.filter((item) => item.uid !== uid) }
          : parte
      ))
    }))
  }

  const actualizarPuntajeItem = (parteId, uid, puntaje) => {
    setFormulario((prev) => ({
      ...prev,
      partes: prev.partes.map((parte) => (
        parte.id === parteId
          ? {
              ...parte,
              items: parte.items.map((item) => (
                item.uid === uid ? { ...item, puntaje } : item
              ))
            }
          : parte
      ))
    }))
  }

  const resumenParte = (parte) => {
    const puntos = parte.items.reduce((acc, item) => acc + toNumber(item.puntaje), 0)
    return {
      cantidadSeleccionada: parte.items.length,
      puntosSeleccionados: puntos
    }
  }

  const totalPrueba = useMemo(
    () => formulario.partes.reduce(
      (acc, parte) => acc + parte.items.reduce((sum, item) => sum + toNumber(item.puntaje), 0),
      0
    ),
    [formulario.partes]
  )

  const ventanaAplicacion = useMemo(() => {
    if (!formulario.fecha_aplicacion || !formulario.duracion_minutos) return null

    const inicio = new Date(formulario.fecha_aplicacion)
    const duracion = Number(formulario.duracion_minutos || 0)
    if (Number.isNaN(inicio.getTime()) || duracion <= 0) return null

    const fin = new Date(inicio.getTime() + (duracion * 60 * 1000))
    return { inicio, fin }
  }, [formulario.fecha_aplicacion, formulario.duracion_minutos])

  const guardarPrueba = async (e) => {
    e.preventDefault()

    if (!formulario.asignatura.trim()) {
      alert("Indique la asignatura de la prueba.")
      return
    }

    if (!formulario.fecha_aplicacion) {
      alert("Indique la fecha y hora de inicio de la prueba.")
      return
    }

    if (!Number(formulario.duracion_minutos) || Number(formulario.duracion_minutos) <= 0) {
      alert("Indique una duración válida en minutos.")
      return
    }

    if (!formulario.partes.length) {
      alert("Agregue al menos una parte a la prueba.")
      return
    }

    for (const parte of formulario.partes) {
      const resumen = resumenParte(parte)
      if (!parte.nombre.trim()) {
        alert("Cada parte debe tener un nombre.")
        return
      }
      if (resumen.cantidadSeleccionada !== Number(parte.cantidad)) {
        alert(`La parte "${parte.nombre}" debe tener exactamente ${parte.cantidad} ítems.`)
        return
      }

      const puntajeObjetivo = toNumber(parte.puntajeObjetivo)
      if (Math.abs(resumen.puntosSeleccionados - puntajeObjetivo) > 0.001) {
        alert(`La parte "${parte.nombre}" debe sumar ${puntajeObjetivo} puntos.`)
        return
      }
    }

    setGuardando(true)

    try {
      const payloadPrueba = {
        centro_educativo: formulario.centro_educativo || null,
        asignatura: formulario.asignatura,
        periodo: formulario.periodo || null,
        nivel: formulario.nivel || null,
        fecha_aplicacion: serializarFechaLocal(formulario.fecha_aplicacion),
        duracion_minutos: Number(formulario.duracion_minutos || 60),
        puntos_totales: totalPrueba,
        porcentaje_total: 100
      }

      let pruebaId = editandoId
      if (editandoId) {
        await api.put(`/pruebas/pruebas/${editandoId}/`, payloadPrueba)
        await limpiarEstructuraPrueba(editandoId)
      } else {
        const pruebaRes = await api.post("/pruebas/pruebas/", payloadPrueba)
        pruebaId = pruebaRes.data.id
      }

      let orden = 1
      for (const [index, parte] of formulario.partes.entries()) {
        const parteRes = await api.post(partesEndpoint, {
          prueba: pruebaId,
          nombre: parte.nombre,
          tipo: parte.tipo,
          orden: index + 1,
          cantidad_requerida: Number(parte.cantidad || 1),
          puntaje_objetivo: toNumber(parte.puntajeObjetivo || 1),
          modo_respuesta: parte.tipo === "respuesta" ? parte.modoRespuesta : "uno"
        })

        for (const item of parte.items) {
          await api.post(endpointsPorTipo[parte.tipo], {
            prueba: pruebaId,
            parte: parteRes.data.id,
            item: item.itemId,
            orden,
            puntaje: item.puntaje
          })
          orden += 1
        }
      }

      alert(editandoId ? "Prueba actualizada correctamente." : "Prueba guardada correctamente.")
      reiniciarFormulario()
      setDetallePrueba({})
      await cargarPruebas()
    } catch (error) {
      console.error(error.response?.data || error)
      alert(editandoId ? "No se pudo actualizar la prueba." : "No se pudo guardar la prueba.")
    } finally {
      setGuardando(false)
    }
  }

  const toggleDetalle = async (pruebaId) => {
    if (detallePrueba[pruebaId]) {
      setDetallePrueba((prev) => {
        const siguiente = { ...prev }
        delete siguiente[pruebaId]
        return siguiente
      })
      return
    }

    setCargandoDetalle((prev) => ({ ...prev, [pruebaId]: true }))
    try {
      const res = await api.get(`/pruebas/pruebas/${pruebaId}/completa/`)
      setDetallePrueba((prev) => ({
        ...prev,
        [pruebaId]: res.data
      }))
    } catch (error) {
      console.error(error.response?.data || error)
      alert("No se pudo cargar el detalle de la prueba.")
    } finally {
      setCargandoDetalle((prev) => ({ ...prev, [pruebaId]: false }))
    }
  }

  const eliminarPrueba = async (pruebaId) => {
    if (!window.confirm("¿Desea eliminar esta prueba?")) return
    await api.delete(`/pruebas/pruebas/${pruebaId}/`)
    setDetallePrueba((prev) => {
      const siguiente = { ...prev }
      delete siguiente[pruebaId]
      return siguiente
    })
    if (editandoId === pruebaId) {
      reiniciarFormulario()
    }
    cargarPruebas()
  }

  const profesoresDisponibles = useMemo(
    () => [...new Set(pruebas.map((prueba) => prueba.usuario_nombre).filter(Boolean))].sort(),
    [pruebas]
  )

  const materiasDisponibles = useMemo(
    () => [...new Set(pruebas.map((prueba) => prueba.asignatura).filter(Boolean))].sort(),
    [pruebas]
  )

  const pruebasFiltradas = useMemo(
    () => pruebas.filter((prueba) => {
      const profesorOk = !filtros.profesor || prueba.usuario_nombre === filtros.profesor
      const materiaOk = !filtros.materia || prueba.asignatura === filtros.materia
      return profesorOk && materiaOk
    }),
    [filtros, pruebas]
  )

  return (
    <div className="bg-gradient">
      <div className="container">
        <AdminPageHeader
          title="Pruebas"
          subtitle="Diseña evaluaciones por partes, controla cantidad de ítems y reabre una prueba cuando necesites ajustarla."
        />

        <div className="card">
          <div className="pruebas-summary-bar">
            <div>
              <strong>{formulario.partes.length}</strong>
              <span>parte(s)</span>
            </div>
            <div>
              <strong>{totalPrueba.toFixed(2)}</strong>
              <span>puntos totales</span>
            </div>
            <div>
              <strong>{editandoId ? `#${editandoId}` : "Nueva"}</strong>
              <span>{editandoId ? "prueba en edición" : "prueba"}</span>
            </div>
            <button type="button" className="btn-success" onClick={agregarParte}>
              Agregar parte
            </button>
          </div>

          <form onSubmit={guardarPrueba}>
            <div className="section-heading">
              <h2>{editandoId ? `Editando prueba #${editandoId}` : "Nueva prueba"}</h2>
              <p>{editandoId ? "Puedes modificar datos generales, partes, puntajes, fecha de inicio y los ítems de cada bloque." : "Completa los datos generales y arma la estructura por partes."}</p>
            </div>

            <div className="pruebas-grid">
              <div>
                <label>Centro educativo</label>
                <input value={formulario.centro_educativo} onChange={(e) => actualizarGeneral("centro_educativo", e.target.value)} />
              </div>
              <div>
                <label>Asignatura</label>
                <input value={formulario.asignatura} onChange={(e) => actualizarGeneral("asignatura", e.target.value)} />
              </div>
              <div>
                <label>Periodo</label>
                <input value={formulario.periodo} onChange={(e) => actualizarGeneral("periodo", e.target.value)} />
              </div>
              <div>
                <label>Nivel</label>
                <input value={formulario.nivel} onChange={(e) => actualizarGeneral("nivel", e.target.value)} />
              </div>
              <div>
                <label>Fecha y hora de inicio</label>
                <input
                  type="datetime-local"
                  value={formulario.fecha_aplicacion}
                  onChange={(e) => actualizarGeneral("fecha_aplicacion", e.target.value)}
                />
              </div>
              <div>
                <label>Duración (minutos)</label>
                <input
                  type="number"
                  min="1"
                  value={formulario.duracion_minutos}
                  onChange={(e) => actualizarGeneral("duracion_minutos", e.target.value)}
                />
              </div>
            </div>

            {ventanaAplicacion && (
              <div className="prueba-window-preview">
                <strong>Ventana de aplicación:</strong>
                <span>
                  {ventanaAplicacion.inicio.toLocaleString()} - {ventanaAplicacion.fin.toLocaleString()}
                </span>
              </div>
            )}

            <div className="pruebas-parts">
              {formulario.partes.map((parte, index) => {
                const resumen = resumenParte(parte)
                const disponibles = catalogos[parte.tipo].filter((item) => {
                  const noUsado = !idsUsadosPorTipo[parte.tipo]?.has(item.id) || parte.items.some((actual) => actual.itemId === item.id)
                  const texto = `${item.enunciado || ""} ${item.resumen || ""}`.toLowerCase()
                  return noUsado && texto.includes(parte.busqueda.toLowerCase())
                })

                return (
                  <section className="prueba-part-card" key={parte.id}>
                    <div className="prueba-part-head">
                      <div>
                        <span className="admin-kicker">Parte {index + 1}</span>
                        <h3>{parte.nombre || "Nueva parte"}</h3>
                      </div>
                      <button type="button" className="btn-danger" onClick={() => eliminarParte(parte.id)}>
                        Quitar parte
                      </button>
                    </div>

                    <div className="pruebas-grid compact">
                      <div>
                        <label>Nombre de la parte</label>
                        <input value={parte.nombre} onChange={(e) => actualizarParte(parte.id, "nombre", e.target.value)} />
                      </div>
                      <div>
                        <label>Tipo de ítem</label>
                        <select value={parte.tipo} onChange={(e) => actualizarParte(parte.id, "tipo", e.target.value)}>
                          {tipoOpciones.map((tipo) => (
                            <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label>Cantidad requerida</label>
                        <input type="number" min="1" value={parte.cantidad} onChange={(e) => actualizarParte(parte.id, "cantidad", e.target.value)} />
                      </div>
                      <div>
                        <label>Puntos de la parte</label>
                        <input type="number" min="0" step="0.25" value={parte.puntajeObjetivo} onChange={(e) => actualizarParte(parte.id, "puntajeObjetivo", e.target.value)} />
                      </div>
                      {parte.tipo === "respuesta" && (
                        <div>
                          <label>Criterio de puntaje</label>
                          <select value={parte.modoRespuesta} onChange={(e) => actualizarParte(parte.id, "modoRespuesta", e.target.value)}>
                            <option value="uno">Un punto por respuesta correcta</option>
                            <option value="manual">Puntaje por ítem / varios pasos</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="prueba-part-status">
                      <span>Ítems seleccionados: {resumen.cantidadSeleccionada} / {parte.cantidad}</span>
                      <span>Puntos: {resumen.puntosSeleccionados.toFixed(2)} / {toNumber(parte.puntajeObjetivo).toFixed(2)}</span>
                    </div>

                    <div className="prueba-part-layout">
                      <div className="prueba-bank">
                        <label>Buscar ítems disponibles</label>
                        <input value={parte.busqueda} onChange={(e) => actualizarParte(parte.id, "busqueda", e.target.value)} placeholder="Escribe para filtrar..." />

                        <div className="prueba-bank-list">
                          {disponibles.length === 0 && <p>No hay ítems disponibles con ese filtro.</p>}
                          {disponibles.map((item) => (
                            <button
                              type="button"
                              className="prueba-bank-item"
                              key={`${parte.id}-${item.id}`}
                              onClick={() => agregarItemAParte(parte.id, item)}
                            >
                              <strong>#{item.id}</strong>
                              <span>{item.resumen}</span>
                              <small>Agregar</small>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="prueba-selected">
                        <h4>Ítems elegidos</h4>
                        <div className="prueba-selected-list">
                          {parte.items.length === 0 && <p>Agrega ítems para completar esta parte.</p>}
                          {parte.items.map((item, itemIndex) => (
                            <div className="prueba-selected-item" key={item.uid}>
                              <div>
                                <strong>{itemIndex + 1}. #{item.itemId}</strong>
                                <p>{item.resumen}</p>
                              </div>

                              <div className="prueba-selected-actions">
                                <label>Puntaje</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.25"
                                  value={item.puntaje}
                                  disabled={parte.tipo === "respuesta" && parte.modoRespuesta === "uno"}
                                  onChange={(e) => actualizarPuntajeItem(parte.id, item.uid, e.target.value)}
                                />
                                <button type="button" className="btn-danger" onClick={() => quitarItemDeParte(parte.id, item.uid)}>
                                  Quitar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>

            <div className="mt-2" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn-primary" disabled={guardando}>
                {guardando ? (editandoId ? "Actualizando..." : "Guardando...") : (editandoId ? "Actualizar prueba" : "Guardar prueba")}
              </button>
              {editandoId && (
                <button type="button" className="btn-secondary" onClick={reiniciarFormulario}>
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="card mt-3">
          <div className="section-heading">
            <h2>Listado de pruebas</h2>
            <p>Filtra por profesor y por materia para revisar, editar o asignar evaluaciones.</p>
          </div>

          <div className="pruebas-grid compact">
            <div>
              <label>Profesor</label>
              <select value={filtros.profesor} onChange={(e) => setFiltros((prev) => ({ ...prev, profesor: e.target.value }))}>
                <option value="">Todos</option>
                {profesoresDisponibles.map((profesor) => (
                  <option key={profesor} value={profesor}>{profesor}</option>
                ))}
              </select>
            </div>

            <div>
              <label>Materia</label>
              <select value={filtros.materia} onChange={(e) => setFiltros((prev) => ({ ...prev, materia: e.target.value }))}>
                <option value="">Todas</option>
                {materiasDisponibles.map((materia) => (
                  <option key={materia} value={materia}>{materia}</option>
                ))}
              </select>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Profesor</th>
                <th>Asignatura</th>
                <th>Nivel</th>
                <th>Puntos</th>
                <th>Duración</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pruebasFiltradas.map((prueba) => (
                <tr key={prueba.id}>
                  <td>{prueba.id}</td>
                  <td>{prueba.usuario_nombre || `Usuario ${prueba.usuario}`}</td>
                  <td>{prueba.asignatura || "-"}</td>
                  <td>{prueba.nivel || "-"}</td>
                  <td>{prueba.puntos_totales || 0}</td>
                  <td>{prueba.duracion_minutos || 60} min</td>
                  <td>{prueba.fecha_aplicacion ? new Date(prueba.fecha_aplicacion).toLocaleString() : "-"}</td>
                  <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn-primary" onClick={() => toggleDetalle(prueba.id)}>
                      {detallePrueba[prueba.id] ? "Ocultar" : "Detalle"}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => cargarPruebaParaEdicion(prueba.id)}>
                      Editar
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => navigate(`/admin/pruebas/${prueba.id}/entregas`)}>
                      Entregas
                    </button>
                    <button type="button" className="btn-success" onClick={() => navigate(`/admin/pruebas/${prueba.id}/asignaciones`)}>
                      Asignar
                    </button>
                    <button type="button" className="btn-danger" onClick={() => eliminarPrueba(prueba.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pruebasFiltradas.map((prueba) => {
            const detalle = detallePrueba[prueba.id]
            const cargando = cargandoDetalle[prueba.id]

            if (!detalle && !cargando) return null

            return (
              <div className="prueba-detail-card mt-2" key={`prueba-detalle-${prueba.id}`}>
                <div className="prueba-detail-top">
                  <div>
                    <h3>Prueba #{prueba.id}</h3>
                    <p>{prueba.asignatura} | {prueba.usuario_nombre || `Usuario ${prueba.usuario}`}</p>
                  </div>
                </div>

                {cargando && <p>Cargando detalle...</p>}

                {detalle && (
                  <div className="prueba-detail-groups">
                    {(detalle.partes || []).map((parte) => {
                      const itemKeys = new Set(parte.item_keys || [])
                      const items = detalle.items.filter((item) => itemKeys.has(`${item.tipo}-${item.id}`))
                      if (!items.length) return null

                      return (
                        <section className="prueba-detail-group" key={`${prueba.id}-${parte.id}`}>
                          <h4>{parte.titulo}</h4>
                          <div className="prueba-detail-items">
                            {items.map((item) => (
                              <article className="prueba-detail-item" key={`${item.tipo}-${item.orden}-${item.id}`}>
                                <strong>{item.orden}. {item.enunciado}</strong>
                                <span>{Number(item.puntaje).toFixed(2)} puntos</span>
                              </article>
                            ))}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
