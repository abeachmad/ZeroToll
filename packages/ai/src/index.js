import express from 'express';

const app = express();
app.use(express.json());

// AI scoring stub - rule-based ETC calculation
app.post('/api/score', (req, res) => {
  const { intent, routes } = req.body;
  
  // Calculate Expected Total Cost (ETC) for each route
  const scores = routes.map(route => {
    // Base costs
    const gasSource = parseFloat(route.gasSource || '0.001');
    const gasDest = parseFloat(route.gasDest || '0.0005');
    const bridgeFee = parseFloat(route.bridgeFee || '0.0002');
    const slippage = parseFloat(route.slippage || '0.001');
    
    // Risk factors (heuristic for MVP)
    const mevRisk = route.mevRisk || 0.0001;
    const revertRisk = route.revertRisk || 0.0001;
    
    // Weights (λ1, λ2)
    const lambda1 = 0.5;
    const lambda2 = 0.3;
    
    const etc = gasSource + gasDest + bridgeFee + slippage + 
                (lambda1 * mevRisk) + (lambda2 * revertRisk);
    
    return {
      routeId: route.id,
      etc,
      breakdown: { gasSource, gasDest, bridgeFee, slippage, mevRisk, revertRisk }
    };
  });
  
  // Sort by lowest ETC
  scores.sort((a, b) => a.etc - b.etc);
  
  res.json({
    bestRoute: scores[0],
    allScores: scores
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', mode: 'rule-based' });
});

const PORT = process.env.AI_PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ AI scoring service running on port ${PORT}`);
});
