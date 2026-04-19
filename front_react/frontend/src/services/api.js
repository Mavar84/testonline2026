import axios from "axios"

let setLoadingGlobal = null
let redireccionandoLogin = false

const esErrorDeSesion = (error) => {
  const data = error.response?.data
  if (!data) return false

  if (data.code === "token_not_valid") return true
  if (Array.isArray(data.messages) && data.messages.some((mensaje) => mensaje?.token_class)) return true

  const detail = `${data.detail || ""}`.toLowerCase()
  return detail.includes("token") && (detail.includes("valid") || detail.includes("expired") || detail.includes("expir"))
}

export const setLoadingHandler = (fn) => {
  setLoadingGlobal = fn
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api"
})

// REQUEST
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  if (setLoadingGlobal) setLoadingGlobal(true)

  return config
})

// RESPONSE
api.interceptors.response.use(
  (response) => {
    if (setLoadingGlobal) setLoadingGlobal(false)
    return response
  },
  (error) => {
    if (setLoadingGlobal) setLoadingGlobal(false)

    if (error.response?.status === 401 && esErrorDeSesion(error) && !redireccionandoLogin) {
      redireccionandoLogin = true
      localStorage.removeItem("token")
      window.location.href = "/"
    }

    return Promise.reject(error)
  }
)

export default api
