import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DisciplineTracker from './components/DisciplineTracker'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/reset" element={<DisciplineTracker />} />
        <Route path="/" element={<Navigate to="/reset" replace />} />
        <Route path="*" element={<Navigate to="/reset" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App