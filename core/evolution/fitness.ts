export  const calculateFitness = (action:any, signals:any) => {

  let score = 0;

  // reward confidence

  score += action.confidence * 0.4;

  // penalize inactivity

  if (action.direction === "flat") {

    score -= 0.3;

  }

  // reward taking action

  if (action.sizeBps > 0) {

    score += 0.4;

  }

  // bonus: if market is trending but agent does nothing → punish

  if (signals.trend === "bullish" && action.direction === "flat") {

    score -= 0.3;

  }

  return score;

};