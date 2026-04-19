import { BrowserRouter, Routes, Route } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route
            path="/"
            element={<div className="p-8 text-2xl font-bold">Ambit — coming soon</div>}
          />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
