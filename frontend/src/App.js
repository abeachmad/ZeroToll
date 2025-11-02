import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '@/App.css';
import { Toaster } from 'sonner';

const Home = lazy(() => import('@/pages/Home'));
const Swap = lazy(() => import('@/pages/Swap'));
const History = lazy(() => import('@/pages/History'));

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Suspense fallback={
          <div className="min-h-screen bg-zt-ink flex items-center justify-center">
            <div className="text-zt-paper text-xl">Loading...</div>
          </div>
        }>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/swap" element={<Swap />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" theme="dark" />
    </div>
  );
}

export default App;
