import { FastifyInstance } from 'fastify';
const { Op } = require('sequelize');
const { TradeJournal, TradeMethod } = require('@ascend/db');

export default async function tradeJournalRoutes(fastify: FastifyInstance) {

  // GET /api/trade-journal/methods — distinct method names
  fastify.get('/api/trade-journal/methods', async (_request, reply) => {
    const methods = await TradeMethod.findAll({ order: [['name', 'ASC']] });
    return reply.send({ data: methods.map((m: any) => m.get('name')) });
  });

  // GET /api/trade-journal/accounts — distinct account values
  fastify.get('/api/trade-journal/accounts', async (_request, reply) => {
    const rows = await TradeJournal.findAll({
      attributes: [[TradeJournal.sequelize!.fn('DISTINCT', TradeJournal.sequelize!.col('account')), 'account']],
      order: [['account', 'ASC']],
      raw: true,
    });
    return reply.send({ data: rows.map((r: any) => r.account) });
  });

  // GET /api/trade-journal — list with optional filters
  fastify.get('/api/trade-journal', async (request, reply) => {
    const q = (request.query as any);
    const status:     string = (q.status     || 'all').toLowerCase();
    const methods:    string = q.methods     || '';
    const accounts:   string = q.accounts    || '';
    const instrument: string = q.instrument  || '';

    const where: Record<string, any> = {};

    if (status === 'open') {
      where.sell_date = { [Op.is]: null };
    } else if (status === 'closed') {
      where.sell_date = { [Op.not]: null };
    }

    if (methods) {
      const list = methods.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (list.length) where.method = { [Op.in]: list };
    }

    if (accounts) {
      const list = accounts.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (list.length) where.account = { [Op.in]: list };
    }

    if (instrument) {
      where.instrument = { [Op.iLike]: `%${instrument.trim()}%` };
    }

    const rows = await TradeJournal.findAll({
      where,
      order: [['id', 'ASC']],
      raw: true,
    });

    // Coerce DECIMAL strings to numbers
    const data = rows.map((r: any) => ({
      ...r,
      qty:        r.qty        != null ? parseFloat(r.qty)        : null,
      buy_price:  r.buy_price  != null ? parseFloat(r.buy_price)  : null,
      sell_price: r.sell_price != null ? parseFloat(r.sell_price) : null,
      stop_loss:  r.stop_loss  != null ? parseFloat(r.stop_loss)  : null,
    }));

    return reply.send({ data, total: data.length });
  });

  // POST /api/trade-journal — create a new trade entry
  fastify.post('/api/trade-journal', async (request, reply) => {
    const body = request.body as any;
    const required = ['instrument', 'method', 'account', 'qty', 'buy_price'];
    for (const key of required) {
      if (!body[key] && body[key] !== 0) return reply.status(400).send({ error: `${key} is required` });
    }
    const now = new Date().toISOString();
    const entry = await TradeJournal.create({
      instrument: String(body.instrument).toUpperCase().trim(),
      method:     body.method,
      account:    body.account,
      qty:        parseFloat(body.qty),
      buy_price:  parseFloat(body.buy_price),
      sell_price: body.sell_price ? parseFloat(body.sell_price) : null,
      stop_loss:  body.stop_loss  ? parseFloat(body.stop_loss)  : null,
      buy_date:   body.buy_date   || null,
      sell_date:  body.sell_date  || null,
      createdAt:  now,
      updatedAt:  now,
    });
    return reply.status(201).send({ ok: true, id: entry.get('id') });
  });

  // POST /api/trade-journal/close-position — FIFO close (full or partial)
  fastify.post('/api/trade-journal/close-position', async (request, reply) => {
    const { account, instrument, sell_qty, sell_price, sell_date } = request.body as any;
    if (!account || !instrument || !sell_qty || !sell_price || !sell_date)
      return reply.status(400).send({ error: 'Missing required fields' });

    const sellQty      = parseFloat(sell_qty);
    const sellPriceNum = parseFloat(sell_price);
    if (isNaN(sellQty) || sellQty <= 0)       return reply.status(400).send({ error: 'Invalid sell_qty' });
    if (isNaN(sellPriceNum) || sellPriceNum <= 0) return reply.status(400).send({ error: 'Invalid sell_price' });

    const openTrades = await TradeJournal.findAll({
      where: {
        account,
        instrument: { [Op.iLike]: instrument },
        sell_date:  { [Op.is]: null },
      },
      order: [['buy_date', 'ASC'], ['id', 'ASC']],
      raw: true,
    });

    const totalOpenQty = openTrades.reduce((s: number, t: any) => s + parseFloat(t.qty), 0);
    if (sellQty > totalOpenQty + 0.0001)
      return reply.status(400).send({ error: `Sell qty (${sellQty}) exceeds total open qty (${totalOpenQty.toFixed(2)})` });

    const now = new Date().toISOString();
    const actions: any[] = [];
    let remaining = sellQty;

    const transaction = await TradeJournal.sequelize.transaction();
    try {
      for (const trade of openTrades) {
        if (remaining < 0.0001) break;
        const tradeQty = parseFloat(trade.qty);

        if (tradeQty <= remaining + 0.0001) {
          // Full close
          await TradeJournal.update(
            { sell_price: sellPriceNum, sell_date, updatedAt: now },
            { where: { id: trade.id }, transaction }
          );
          actions.push({ tradeId: trade.id, type: 'full_close', qty: tradeQty });
          remaining -= tradeQty;
        } else {
          // Partial — split the trade
          const closedQty   = remaining;
          const remainQty   = tradeQty - remaining;

          await TradeJournal.update(
            { qty: remainQty, updatedAt: now },
            { where: { id: trade.id }, transaction }
          );

          const newTrade = await TradeJournal.create({
            method:     trade.method,
            account:    trade.account,
            instrument: trade.instrument,
            qty:        closedQty,
            buy_price:  parseFloat(trade.buy_price),
            sell_price: sellPriceNum,
            stop_loss:  trade.stop_loss != null ? parseFloat(trade.stop_loss) : null,
            buy_date:   trade.buy_date,
            sell_date,
            createdAt:  now,
            updatedAt:  now,
          }, { transaction });

          actions.push({ tradeId: trade.id, type: 'split', closedQty, remainQty, newTradeId: newTrade.get('id') });
          remaining = 0;
        }
      }

      await transaction.commit();
      return reply.send({ ok: true, actions });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  });

  // DELETE /api/trade-journal/:id — delete a trade entry
  fastify.delete('/api/trade-journal/:id', async (request, reply) => {
    const { id } = request.params as any;
    const count = await TradeJournal.destroy({ where: { id } });
    if (!count) return reply.status(404).send({ error: 'Trade not found' });
    return reply.send({ ok: true });
  });

  // PATCH /api/trade-journal/:id — update a trade entry
  fastify.patch('/api/trade-journal/:id', async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;

    const allowed = ['instrument', 'method', 'account', 'qty', 'buy_price', 'sell_price', 'stop_loss', 'buy_date', 'sell_date'];
    const updates: Record<string, any> = {};
    for (const key of allowed) {
      if (key in body) {
        updates[key] = body[key] === '' ? null : body[key];
      }
    }
    if (updates.instrument) updates.instrument = String(updates.instrument).toUpperCase().trim();

    const [count] = await TradeJournal.update(updates, { where: { id } });
    if (!count) return reply.status(404).send({ error: 'Trade not found' });
    return reply.send({ ok: true });
  });
}
