import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import '@/App.css';
import { Toaster } from 'sonner';
import { Web3Provider } from '@/providers/Web3Provider';

const Home = lazy(() => import('@/pages/Home'));
const Swap = lazy(() => import('@/pages/Swap'));
const History = lazy(() => import('@/pages/History'));
const Market = lazy(() => import('@/pages/Market'));
const Pool = lazy(() => import('@/pages/Pool'));
const LiquidityPool = lazy(() => import('@/pages/LiquidityPool'));
const Docs = lazy(() => import('@/pages/Docs'));
const TestMetaMask7702 = lazy(() => import('@/components/TestMetaMask7702'));
const TestSmartAccount = lazy(() => import('@/components/TestSmartAccount'));

function App() {
  return (
    <Web3Provider>
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
              <Route path="/market" element={<Market />} />
              <Route path="/pool" element={<Pool />} />
              <Route path="/pool/dashboard" element={<LiquidityPool />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/test-7702" element={<TestMetaMask7702 />} />
              <Route path="/test-smart-account" element={<TestSmartAccount />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster position="top-right" theme="dark" />
      </div>
    </Web3Provider>
  );
}

export default App;
