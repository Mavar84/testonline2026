const bloquesLatex = [
  { label: "x²", insert: "$x^2$" },
  { label: "x³", insert: "$x^3$" },
  { label: "xⁿ", insert: "$x^n$" },
  { label: "a/b", insert: "$\\frac{a}{b}$" },
  { label: "√x", insert: "$\\sqrt{x}$" },
  { label: "∛x", insert: "$\\sqrt[3]{x}$" },
  { label: "π", insert: "$\\pi$" },
  { label: "θ", insert: "$\\theta$" },
  { label: "α", insert: "$\\alpha$" },
  { label: "β", insert: "$\\beta$" },
  { label: "Σ", insert: "$\\sum_{i=1}^{n}$" },
  { label: "∫", insert: "$\\int_a^b$" },
  { label: "lim", insert: "$\\lim_{x \\to a}$" },
  { label: "sin", insert: "$\\sin(x)$" },
  { label: "cos", insert: "$\\cos(x)$" },
  { label: "tan", insert: "$\\tan(x)$" },
  { label: "|x|", insert: "$|x|$" },
  { label: "≤", insert: "$\\leq$" },
  { label: "≥", insert: "$\\geq$" },
  { label: "≠", insert: "$\\neq$" },
  { label: "±", insert: "$\\pm$" },
  { label: "∞", insert: "$\\infty$" },
  { label: "∈", insert: "$\\in$" },
  { label: "∉", insert: "$\\notin$" },
  { label: "∪", insert: "$\\cup$" },
  { label: "∩", insert: "$\\cap$" },
  { label: "→", insert: "$\\to$" },
  { label: "↔", insert: "$\\leftrightarrow$" }
]

export default function MathKeyboard({ activo, onInsert }) {
  if (!activo) return null

  return (
    <div className="math-keyboard">
      {bloquesLatex.map((item) => (
        <button
          type="button"
          className="math-key"
          key={item.label}
          onClick={() => onInsert(item.insert)}
          title={item.insert}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
