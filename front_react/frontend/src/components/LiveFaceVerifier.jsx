import { useEffect, useRef, useState } from "react"
import axios from "axios"

const INTERVALO_VERIFICACION_MS = 1400
const APROBACIONES_CONSECUTIVAS_REQUERIDAS = 3

function capturarZonaGuia(video, quality = 0.9) {
  const cropWidth = Math.floor(video.videoWidth * 0.72)
  const cropHeight = Math.floor(video.videoHeight * 0.88)
  const x = Math.max(Math.floor((video.videoWidth - cropWidth) / 2), 0)
  const y = Math.max(Math.floor((video.videoHeight - cropHeight) / 2), 0)

  const canvas = document.createElement("canvas")
  canvas.width = cropWidth
  canvas.height = cropHeight
  const context = canvas.getContext("2d")
  context.drawImage(video, x, y, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
  return canvas.toDataURL("image/jpeg", quality)
}

export default function LiveFaceVerifier({
  username,
  preloginToken,
  onSuccess,
  onCancel,
}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const intervalRef = useRef(null)
  const enviandoRef = useRef(false)
  const aprobacionesRef = useRef(0)

  const [cameraActiva, setCameraActiva] = useState(false)
  const [estado, setEstado] = useState("Preparando cámara...")
  const [error, setError] = useState("")
  const [metricas, setMetricas] = useState(null)

  useEffect(() => {
    iniciarCamara()
    return () => {
      detenerVerificacion()
      detenerCamara()
    }
  }, [])

  const detenerVerificacion = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const detenerCamara = () => {
    const video = videoRef.current
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (video) {
      video.pause()
      video.srcObject = null
    }
    setCameraActiva(false)
  }

  const iniciarCamara = async () => {
    setError("")
    setEstado("Preparando cámara...")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      })

      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.onloadedmetadata = async () => {
          try {
            await video.play()
            setCameraActiva(true)
            setEstado("Validando rostro...")
            iniciarVerificacion()
          } catch (err) {
            console.error(err)
            setError("La cámara se abrió, pero no se pudo iniciar la vista previa.")
          }
        }
      }
    } catch (err) {
      console.error(err)
      setError("No se pudo abrir la cámara en este navegador.")
    }
  }

  const capturarFotograma = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) {
      return null
    }

    return capturarZonaGuia(video, 0.9)
  }

  const intentarVerificacion = async () => {
    if (enviandoRef.current) return

    const foto = capturarFotograma()
    if (!foto) return

    enviandoRef.current = true
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/usuarios/login-facial/", {
        username,
        prelogin_token: preloginToken,
        foto_estudiante: foto
      })

      aprobacionesRef.current += 1
      setMetricas(res.data)

      if (aprobacionesRef.current < APROBACIONES_CONSECUTIVAS_REQUERIDAS) {
        setEstado(`Confirmando identidad... ${aprobacionesRef.current}/${APROBACIONES_CONSECUTIVAS_REQUERIDAS}`)
        return
      }

      detenerVerificacion()
      detenerCamara()
      setEstado("Identidad confirmada.")
      onSuccess(res.data)
    } catch (err) {
      const data = err.response?.data
      if (err.response?.status === 401 && data?.detail === "La foto no coincide con la registrada.") {
        aprobacionesRef.current = 0
        setMetricas(data)
        setEstado("Validando rostro...")
      } else {
        detenerVerificacion()
        setError(data?.detail || "No se pudo completar la validación facial.")
      }
    } finally {
      enviandoRef.current = false
    }
  }

  const iniciarVerificacion = () => {
    detenerVerificacion()
    intentarVerificacion()
    intervalRef.current = setInterval(intentarVerificacion, INTERVALO_VERIFICACION_MS)
  }

  return (
    <div className="face-step">
      <div className="face-step-head">
        <div>
          <h3>3. Verificación facial</h3>
          <p>Mira al frente. El sistema intentará validar tu rostro automáticamente hasta aprobar.</p>
        </div>
        <span className={cameraActiva ? "face-status active" : "face-status"}>{estado}</span>
      </div>

      <div className="face-camera-stage">
        <div className="camera-guide-shell">
          <video ref={videoRef} autoPlay playsInline muted className="photo-video" />
          <div className="camera-guide-overlay" aria-hidden="true">
            <div className="camera-guide-oval" />
            <span className="camera-guide-tip">Mantén ojos, nariz y boca dentro de la guía</span>
          </div>
        </div>
      </div>

      {metricas && !error && (
        <p className="face-hint">
          Intentando... similitud {metricas.similitud} | orientación {metricas.orientacion} | confirmaciones {aprobacionesRef.current}/{APROBACIONES_CONSECUTIVAS_REQUERIDAS}
        </p>
      )}

      {error && <p className="auth-error">{error}</p>}

      <div className="face-actions">
        <button type="button" className="btn-secondary" onClick={() => {
          detenerVerificacion()
          detenerCamara()
          onCancel()
        }}>
          Volver a credenciales
        </button>
      </div>
    </div>
  )
}
