import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Copy, TrendingUp, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { PYTH_FEEDS, PYTH_HERMES_URL } from '../config/pyth.feeds';
import ConnectButton from '../components/ConnectButton';

const Market = () => {
  const navigate = useNavigate();
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, []);

  const fetchPrices = async () => {
    try {
      const priceIds = Object.values(PYTH_FEEDS).map(f => f.priceId);
      const idsParam = priceIds.map(id => `ids[]=${id}`).join('&');
      
      const response = await fetch(`${PYTH_HERMES_URL}/v2/updates/price/latest?${idsParam}`);
      const data = await response.json();
      
      const priceMap = {};
      data.parsed?.forEach(item => {
        const feed = Object.values(PYTH_FEEDS).find(f => f.priceId === '0x' + item.id);
        if (feed) {
          const price = item.price.price * Math.pow(10, item.price.expo);
          const conf = item.price.conf * Math.pow(10, item.price.expo);
          const age = Math.floor((Date.now() / 1000) - item.price.publish_time);
          
          priceMap[feed.symbol] = {
            price: price.toFixed(price < 1 ? 6 : 2),
            confidence: ((conf / price) * 100).toFixed(2),
            age,
            publishTime: item.price.publish_time
          };
        }
      });
      
      setPrices(priceMap);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error('Failed to fetch prices:', error);
      toast.error('Failed to fetch live prices');
    } finally {
      setLoading(false);
    }
  };

  const copyFeedId = (priceId) => {
    navigator.clipboard.writeText(priceId);
    toast.success('Feed ID copied!');
  };

  return (
    <div className="min-h-screen bg-zt-ink noise-overlay">
      <header className="border-b border-white/10 backdrop-blur-sm bg-zt-ink/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-zt-paper/70 hover:text-zt-aqua transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-lg font-semibold">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <img src="/logo-mark.svg" alt="ZeroToll" className="w-8 h-8" />
            <span className="text-xl font-bold text-zt-paper">ZeroToll</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/swap')}
              className="text-zt-paper/70 hover:text-zt-aqua transition-colors"
            >
              Swap
            </button>
            <button
              onClick={() => navigate('/history')}
              className="text-zt-paper/70 hover:text-zt-aqua transition-colors"
            >
              History
            </button>
            <ConnectButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-zt-paper mb-2">Live Market Prices</h1>
            <p className="text-zt-paper/60">Real-time price feeds powered by Pyth Network</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-zt-aqua text-sm">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Updates every 10s</span>
            </div>
            <button
              onClick={fetchPrices}
              className="btn-secondary"
              disabled={loading}
            >
              Refresh Now
            </button>
          </div>
        </div>

        <div className="glass-strong rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-zt-paper/70 font-semibold">Token</th>
                  <th className="text-right p-4 text-zt-paper/70 font-semibold">Price (USD)</th>
                  <th className="text-right p-4 text-zt-paper/70 font-semibold">Confidence</th>
                  <th className="text-right p-4 text-zt-paper/70 font-semibold">Age</th>
                  <th className="text-left p-4 text-zt-paper/70 font-semibold">Feed ID</th>
                  <th className="text-center p-4 text-zt-paper/70 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center p-8 text-zt-paper/50">
                      Loading prices...
                    </td>
                  </tr>
                ) : (
                  Object.entries(PYTH_FEEDS).map(([key, feed]) => {
                    const priceData = prices[feed.symbol];
                    return (
                      <tr key={key} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{feed.logo}</span>
                            <div>
                              <p className="text-zt-paper font-semibold">{feed.symbol}</p>
                              <p className="text-zt-paper/50 text-sm">{feed.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <TrendingUp className="w-4 h-4 text-green-400" />
                            <span className="text-zt-paper text-lg font-bold">
                              ${priceData?.price || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            parseFloat(priceData?.confidence || 0) < 0.5 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            ±{priceData?.confidence || '—'}%
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1 text-zt-paper/70">
                            <Clock className="w-3 h-3" />
                            <span className="text-sm">{priceData?.age || '—'}s</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <code className="text-zt-paper/50 text-xs font-mono">
                            {feed.priceId.slice(0, 10)}...{feed.priceId.slice(-8)}
                          </code>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => copyFeedId(feed.priceId)}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-zt-aqua"
                            title="Copy Feed ID"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 glass p-6 rounded-xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-zt-violet/20 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-zt-violet" />
            </div>
            <div>
              <h3 className="text-zt-paper font-semibold mb-2">About Pyth Network</h3>
              <p className="text-zt-paper/70 text-sm leading-relaxed">
                Pyth Network provides real-time, high-fidelity price feeds for DeFi applications. 
                All prices shown are sourced directly from Pyth's Hermes service with sub-second latency. 
                Confidence intervals represent the uncertainty in the price, with lower values indicating higher accuracy.
              </p>
              <div className="mt-4 flex items-center gap-4 text-xs text-zt-paper/50">
                <span>Last updated: {new Date(lastUpdate).toLocaleTimeString()}</span>
                <span>•</span>
                <span>Source: Pyth Hermes</span>
                <span>•</span>
                <a 
                  href="https://pyth.network" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-zt-aqua hover:text-zt-violet transition-colors"
                >
                  Learn more →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Market;
