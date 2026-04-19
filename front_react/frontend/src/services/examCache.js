const DB_NAME = "test-online-exam-cache"
const STORE_NAME = "exam_sessions"
const DB_VERSION = 1

function abrirDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "pruebaId" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function obtenerSesionExamen(pruebaId) {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(String(pruebaId))
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function guardarSesionExamen(session) {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const request = store.put({
      ...session,
      pruebaId: String(session.pruebaId),
      updatedAt: Date.now()
    })
    request.onsuccess = () => resolve(true)
    request.onerror = () => reject(request.error)
  })
}

export async function eliminarSesionExamen(pruebaId) {
  const db = await abrirDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const request = store.delete(String(pruebaId))
    request.onsuccess = () => resolve(true)
    request.onerror = () => reject(request.error)
  })
}
