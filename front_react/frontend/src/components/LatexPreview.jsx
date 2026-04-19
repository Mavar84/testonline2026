const renderLatexTokens = (value) => {
  const partes = String(value || "").split(/(\$[^$]+\$)/g).filter(Boolean)

  return partes.map((parte, index) => {
    const esLatex = parte.startsWith("$") && parte.endsWith("$")

    if (esLatex) {
      return (
        <code className="latex-chip" key={`${parte}-${index}`}>
          {parte}
        </code>
      )
    }

    return <span key={`${parte}-${index}`}>{parte}</span>
  })
}

export default function LatexPreview({ visible, value }) {
  if (!visible || !String(value || "").trim()) return null

  return (
    <div className="latex-preview">
      <span className="latex-preview-label">Vista previa LaTeX</span>
      <div className="latex-preview-body">
        {renderLatexTokens(value)}
      </div>
    </div>
  )
}
