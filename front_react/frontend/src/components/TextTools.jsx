const aplicarTransformacion = (valor, tipo) => {
  if (tipo === "trim") return valor.replace(/\s+/g, " ").trim()
  if (tipo === "capitalize") return valor.charAt(0).toUpperCase() + valor.slice(1)
  if (tipo === "question") {
    const limpio = valor.trim()
    if (!limpio) return valor
    const sinSignos = limpio.replace(/^¿/, "").replace(/\?$/, "")
    return `¿${sinSignos}?`
  }
  if (tipo === "period") {
    const limpio = valor.trim()
    if (!limpio || /[.!?]$/.test(limpio)) return limpio
    return `${limpio}.`
  }

  return valor
}

export default function TextTools({ value, onChange, onInsert }) {
  const aplicar = (tipo) => {
    onChange(aplicarTransformacion(value || "", tipo))
  }

  return (
    <div className="text-tools">
      <button type="button" title="Negrita" onClick={() => onInsert("**texto**")}>
        B
      </button>
      <button type="button" title="Cursiva" onClick={() => onInsert("_texto_")}>
        I
      </button>
      <button type="button" title="Fracción" onClick={() => onInsert("()/()")}>
        a/b
      </button>
      <button type="button" title="Limpiar espacios" onClick={() => aplicar("trim")}>
        Aa
      </button>
      <button type="button" title="Mayúscula inicial" onClick={() => aplicar("capitalize")}>
        A.
      </button>
      <button type="button" title="Convertir en pregunta" onClick={() => aplicar("question")}>
        ¿?
      </button>
      <button type="button" title="Agregar punto final" onClick={() => aplicar("period")}>
        .
      </button>
    </div>
  )
}
