import { useEffect, useRef, useState } from "react"

function leerArchivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function capturarZonaGuia(video, quality = 0.92) {
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

export default function PhotoCaptureInput({
  value,
  onChange,
  label = "Foto",
  helpText = "Coloca el rostro centrado y con buena luz.",
  allowUpload = true
}) {
  const videoRef = useRef(null)
  const fileInputRef = useRef(null)
  const streamRef = useRef(null)

  const [cameraActiva, setCameraActiva] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current

    if (!cameraActiva || !video || !stream) return

    video.srcObject = stream
    video.onloadedmetadata = () => {
      video.play().catch((err) => {
        console.error(err)
        setError("La cámara se abrió, pero no se pudo mostrar la vista previa.")
      })
    }
  }, [cameraActiva])

  const iniciarCamara = async () => {
    setError("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      })

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      streamRef.current = stream
      setCameraActiva(true)
    } catch (err) {
      console.error(err)
      setError("No se pudo abrir la cámara en este navegador.")
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

  const capturar = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("La cámara todavía no está lista.")
      return
    }

    onChange(capturarZonaGuia(video, 0.92))
    detenerCamara()
  }

  const subirArchivo = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const dataUrl = await leerArchivoComoDataUrl(file)
      onChange(dataUrl)
      setError("")
    } catch (err) {
      console.error(err)
      setError("No se pudo leer el archivo seleccionado.")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <div className="photo-capture">
      <div className="photo-capture-head">
        <div>
          <label>{label}</label>
          <p>{helpText}</p>
        </div>
        <div className="photo-capture-actions">
          {!cameraActiva && (
            <button type="button" className="btn-secondary" onClick={iniciarCamara}>
              Usar cámara
            </button>
          )}
          {cameraActiva && (
            <>
              <button type="button" className="btn-primary" onClick={capturar}>
                Tomar foto
              </button>
              <button type="button" className="btn-secondary" onClick={detenerCamara}>
                Cerrar cámara
              </button>
            </>
          )}
          {allowUpload && (
            <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Subir archivo
            </button>
          )}
        </div>
      </div>

      {allowUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden-file-input"
          onChange={subirArchivo}
        />
      )}

      <div className="photo-capture-stage">
        {cameraActiva ? (
          <div className="camera-guide-shell">
            <video ref={videoRef} autoPlay playsInline muted className="photo-video" />
            <div className="camera-guide-overlay" aria-hidden="true">
              <div className="camera-guide-oval" />
              <span className="camera-guide-tip">Centra tu rostro dentro de la guía</span>
            </div>
          </div>
        ) : value ? (
          <img src={value} alt="Foto del estudiante" className="photo-preview" />
        ) : (
          <div className="photo-placeholder">
            <span>Sin foto registrada todavía</span>
          </div>
        )}
      </div>

      {value && !cameraActiva && (
        <div className="photo-inline-toolbar">
          <button type="button" className="btn-secondary" onClick={iniciarCamara}>
            Repetir con cámara
          </button>
          <button type="button" className="btn-secondary" onClick={() => onChange("")}>
            Quitar foto
          </button>
        </div>
      )}

      {error && <p className="auth-error">{error}</p>}
    </div>
  )
}
