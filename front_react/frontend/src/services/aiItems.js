import api from "./api"

export const generarOpcionesSeleccionUnica = async (enunciado) => {
  const res = await api.post("/items/ai/seleccion-unica/", { enunciado })
  return res.data
}

export const generarRespuestasUnicas = async (enunciado) => {
  const res = await api.post("/items/ai/respuesta-unica/", { enunciado })
  return res.data.respuestas
}
