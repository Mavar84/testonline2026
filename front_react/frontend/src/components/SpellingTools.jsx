export default function SpellingTools({ language, onLanguageChange }) {
  return (
    <div className="spelling-native-tools">
      <span>Ortografía del navegador</span>
      <select value={language} onChange={(e) => onLanguageChange(e.target.value)}>
        <option value="es">Español</option>
        <option value="en">English</option>
        <option value="auto">Auto</option>
      </select>
    </div>
  )
}
