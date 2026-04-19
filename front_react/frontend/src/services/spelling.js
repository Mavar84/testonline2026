import api from "./api"

export const revisarOrtografia = async (texto) => {
  const res = await api.post("/items/ortografia/", { texto })
  return res.data
}
