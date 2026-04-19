import { useState, useRef, useEffect } from "react"
import { hashArchivo } from "../services/documentos"

// =========================
// INDEXED DB ROBUSTO
// =========================

const abrirDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("documentosDB", 5)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      if (!db.objectStoreNames.contains("documentos")) {
        db.createObjectStore("documentos", {
          keyPath: "id",
          autoIncrement: true
        })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const guardarDocumentoDB = async (doc) => {
  const db = await abrirDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction("documentos", "readwrite")
    const store = tx.objectStore("documentos")

    const req = store.add(doc)

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const obtenerDocumentosDB = async () => {
  const db = await abrirDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction("documentos", "readonly")
    const store = tx.objectStore("documentos")

    const req = store.getAll()

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

const eliminarDocumentoDB = async (id) => {
  const db = await abrirDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction("documentos", "readwrite")
    const store = tx.objectStore("documentos")

    store.delete(id)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// =========================
// COMPONENTE
// =========================

export default function DocumentoUploader({ onDocumentoAgregado }) {

  const [tipo, setTipo] = useState("imagen")
  const [documentos, setDocumentos] = useState([])

  const [grabando, setGrabando] = useState(false)
  const [pausado, setPausado] = useState(false)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])

  const videoPreviewRef = useRef(null)
  const canvasAudioRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animationRef = useRef(null)

  useEffect(() => {
    obtenerDocumentosDB().then(setDocumentos)
  }, [])

  // =========================
  // FIX PREVIEW VIDEO
  // =========================

  useEffect(() => {
    if (grabando && videoPreviewRef.current && streamRef.current) {
      videoPreviewRef.current.srcObject = streamRef.current

      videoPreviewRef.current.onloadedmetadata = () => {
        videoPreviewRef.current.play().catch(() => {})
      }
    }
  }, [grabando])

  // =========================
  // FIX PREVIEW AUDIO
  // =========================

  useEffect(() => {
    if (grabando && tipo === "audio" && streamRef.current && canvasAudioRef.current) {
      iniciarVisualAudio(streamRef.current)
    }
  }, [grabando, tipo])

  const procesarArchivo = async (file, tipoDoc) => {
    try {
      const hash = await hashArchivo(file)

      const doc = {
        tipo: tipoDoc,
        file,
        hash,
        fecha: new Date().toISOString()
      }

      const id = await guardarDocumentoDB(doc)

      const docConId = { ...doc, id }

      setDocumentos(prev => [...prev, docConId])
      onDocumentoAgregado && onDocumentoAgregado(docConId)

    } catch (e) {
      console.error(e)
      alert("Error procesando documento")
    }
  }

  const handleArchivo = (e, tipoDoc) => {
    const file = e.target.files[0]
    if (!file) return
    procesarArchivo(file, tipoDoc)
  }

  // =========================
  // AUDIO VISUAL
  // =========================

  const iniciarVisualAudio = (stream) => {
    const canvas = canvasAudioRef.current
    if (!canvas) return

    const audioCtx = new AudioContext()
    const analyser = audioCtx.createAnalyser()
    const source = audioCtx.createMediaStreamSource(stream)

    source.connect(analyser)
    analyser.fftSize = 64

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const ctx = canvas.getContext("2d")

    const draw = () => {
      analyser.getByteFrequencyData(dataArray)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const barWidth = (canvas.width / bufferLength) * 2.5
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i]
        ctx.fillStyle = "green"
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
        x += barWidth + 1
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    audioContextRef.current = audioCtx
    analyserRef.current = analyser
  }

  const detenerVisualAudio = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    if (audioContextRef.current) audioContextRef.current.close()
  }

  // =========================
  // GRABACIÓN
  // =========================

  const iniciarGrabacion = async (modo) => {
    try {
      let stream

      if (modo === "audio") {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }

      if (modo === "video") {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      }

      if (modo === "pantalla") {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      }

      if (modo === "pantalla_audio") {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true })

        stream = new MediaStream([
          ...screen.getTracks(),
          ...mic.getTracks()
        ])
      }

      streamRef.current = stream

 const recorder = new MediaRecorder(stream, {
  mimeType: "video/webm;codecs=vp9",
  videoBitsPerSecond: 500000, // 🔥 baja calidad = menos peso
  audioBitsPerSecond: 64000
})

      chunksRef.current = []

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" })
        const file = new File([blob], "grabacion.webm")

        procesarArchivo(file, modo === "audio" ? "audio" : "video")
      }

      recorderRef.current = recorder

      recorder.start()
      setGrabando(true)
      setPausado(false)

    } catch (e) {
      console.error(e)
      alert("Error iniciando grabación")
    }
  }

  const pausarGrabacion = () => {
    recorderRef.current.pause()
    setPausado(true)
  }

  const reanudarGrabacion = () => {
    recorderRef.current.resume()
    setPausado(false)
  }

  const detenerGrabacion = () => {
    recorderRef.current.stop()
    streamRef.current.getTracks().forEach(t => t.stop())

    detenerVisualAudio()

    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null
    }

    setGrabando(false)
    setPausado(false)
  }

  const renderPreview = (doc) => {
    const url = URL.createObjectURL(doc.file)

    if (doc.tipo === "imagen") return <img src={url} width="120" />
    if (doc.tipo === "pdf") return <iframe src={url} width="120" height="80" />
    if (doc.tipo === "audio") return <audio controls src={url} />
    if (doc.tipo === "video") return <video controls width="120" src={url} />

    return null
  }

  const eliminarDocumento = async (doc) => {
    await eliminarDocumentoDB(doc.id)
    setDocumentos(prev => prev.filter(d => d.id !== doc.id))
  }

  const estiloTab = (activo) => ({
    padding: "8px 12px",
    borderRadius: 8,
    background: activo ? "#2563eb" : "#e5e7eb",
    color: activo ? "#fff" : "#000",
    border: "none",
    cursor: "pointer"
  })

  return (
    <div className="card mt-2">

      <h3>Documentos</h3>

      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" style={estiloTab(tipo==="imagen")} onClick={() => setTipo("imagen")}>Imagen</button>
        <button type="button" style={estiloTab(tipo==="pdf")} onClick={() => setTipo("pdf")}>PDF</button>
        <button type="button" style={estiloTab(tipo==="video")} onClick={() => setTipo("video")}>Video</button>
        <button type="button" style={estiloTab(tipo==="audio")} onClick={() => setTipo("audio")}>Audio</button>
      </div>

      <div className="mt-2">

        {tipo === "imagen" && <input type="file" accept="image/*" onChange={(e) => handleArchivo(e, "imagen")} />}
        {tipo === "pdf" && <input type="file" accept="application/pdf" onChange={(e) => handleArchivo(e, "pdf")} />}

        {tipo === "video" && (
          <>
            <input type="file" accept="video/*" onChange={(e) => handleArchivo(e, "video")} />

            {!grabando && (
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button type="button" className="btn-primary" onClick={() => iniciarGrabacion("video")}>Cámara</button>
                <button type="button" className="btn-secondary" onClick={() => iniciarGrabacion("pantalla")}>Pantalla</button>
                <button type="button" className="btn-success" onClick={() => iniciarGrabacion("pantalla_audio")}>Pantalla + Audio</button>
              </div>
            )}
          </>
        )}

        {tipo === "audio" && (
          <>
            <input type="file" accept="audio/*" onChange={(e) => handleArchivo(e, "audio")} />

            {!grabando && (
              <button type="button" className="btn-primary mt-1" onClick={() => iniciarGrabacion("audio")}>
                Grabar audio
              </button>
            )}
          </>
        )}

        {grabando && (
          <>
            {tipo === "video" && (
              <video ref={videoPreviewRef} autoPlay muted width="200" />
            )}

            {tipo === "audio" && (
              <canvas ref={canvasAudioRef} width="200" height="60" />
            )}

            <div className="mt-2" style={{ display: "flex", gap: 10 }}>
              {!pausado
                ? <button type="button" className="btn-secondary" onClick={pausarGrabacion}>Pausar</button>
                : <button type="button" className="btn-primary" onClick={reanudarGrabacion}>Reanudar</button>
              }

              <button type="button" className="btn-danger" onClick={detenerGrabacion}>
                Detener
              </button>
            </div>
          </>
        )}

      </div>

      <div className="mt-2">
        {documentos.map((doc) => (
          <div key={doc.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {renderPreview(doc)}
            <span>{doc.tipo}</span>

            <button type="button" className="btn-danger" onClick={() => eliminarDocumento(doc)}>
              Eliminar
            </button>
          </div>
        ))}
      </div>

    </div>
  )
}
