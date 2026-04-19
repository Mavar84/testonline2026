export default function LoadingOverlay({ visible }) {
  if (!visible) return null

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.4)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999
    }}>
      <div style={{
        background: "white",
        padding: "20px 30px",
        borderRadius: "10px",
        display: "flex",
        alignItems: "center",
        gap: "15px"
      }}>
        <div className="spinner"></div>
        <span>Cargando...</span>
      </div>
    </div>
  )
}