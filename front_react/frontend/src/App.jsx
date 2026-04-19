import { useContext, useEffect } from "react"
import { LoadingContext } from "./context/LoadingContext"
import { setLoadingHandler } from "./services/api"
import LoadingOverlay from "./components/LoadingOverlay"
import AppRoutes from "./routes/AppRoutes"

function App() {
  const { loading, setLoading } = useContext(LoadingContext)

  useEffect(() => {
    setLoadingHandler(setLoading)
  }, [])

  return (
    <>
      <LoadingOverlay visible={loading} />
      <AppRoutes />
    </>
  )
}

export default App