import { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.post('/calculate', {
    schema: {
      body: {
        type: 'object',
        required: ['strategy'],
        properties: {
          strategy: { type: 'string', enum: ['Fixed Risk', 'Fixed Fractional', 'Kelly Criterion', 'Fixed Units'] },
          accountSize: { type: 'number', minimum: 0 },
          riskPercent: { type: 'number', minimum: 0, maximum: 100 },
          entryPrice: { type: 'number', exclusiveMinimum: 0 },
          stopLossPrice: { type: 'number', minimum: 0 },
          fraction: { type: 'number', minimum: 0, maximum: 1 },
          winRate: { type: 'number', minimum: 0, maximum: 1 },
          avgWin: { type: 'number', minimum: 0 },
          avgLoss: { type: 'number', exclusiveMinimum: 0 },
          units: { type: 'number', minimum: 1 },
        }
      }
    }
  }, async (request, reply) => {
    const data = request.body as any;
    const { strategy } = data;

    let quantity = 0;
    let riskAmount = 0;
    let positionValue = 0;
    let riskPerShare = 0;

    if (strategy === 'Fixed Risk') {
      const { accountSize, riskPercent, entryPrice, stopLossPrice } = data;
      if (entryPrice === stopLossPrice) {
        return reply.status(400).send({ error: 'entryPrice and stopLossPrice cannot be equal for Fixed Risk' });
      }
      riskPerShare = Math.abs(entryPrice - stopLossPrice);
      riskAmount = accountSize * (riskPercent / 100);
      quantity = Math.floor(riskAmount / riskPerShare);
      positionValue = quantity * entryPrice;
    } else if (strategy === 'Fixed Fractional') {
      const { accountSize, fraction, entryPrice } = data;
      riskAmount = accountSize * fraction;
      quantity = Math.floor(riskAmount / entryPrice);
      positionValue = quantity * entryPrice;
      riskPerShare = riskAmount / (quantity || 1);
    } else if (strategy === 'Kelly Criterion') {
      const { winRate, avgWin, avgLoss, accountSize, entryPrice } = data;
      const kellyPct = winRate - ((1 - winRate) / (avgWin / avgLoss));
      const safeKelly = Math.max(0, kellyPct); // Don't allow negative kelly
      riskAmount = accountSize * safeKelly;
      quantity = Math.floor(riskAmount / entryPrice);
      positionValue = quantity * entryPrice;
      riskPerShare = riskAmount / (quantity || 1);

    } else if (strategy === 'Fixed Units') {
      const { units, entryPrice } = data;
      quantity = units || 0;
      positionValue = quantity * entryPrice;
      riskAmount = 0; // Not applicable
      riskPerShare = 0; // Not applicable
    }

    return reply.send({

      quantity,
      positionValue,
      riskAmount,
      riskPerShare
    });
  });
}
