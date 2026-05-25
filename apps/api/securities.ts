import { FastifyInstance } from 'fastify';
import { Op } from 'sequelize';
const { Security } = require('@ascend/db');

const PAGE_SIZE = 100;

export default async function securitiesRoutes(fastify: FastifyInstance) {

    // GET /api/securities?page=1&search=
    fastify.get('/api/securities', async (request, reply) => {
        const { page = '1', search = '' } = request.query as { page?: string; search?: string };
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const offset  = (pageNum - 1) * PAGE_SIZE;

        const where = search
            ? {
                [Op.or]: [
                    { symbol:          { [Op.iLike]: `%${search}%` } },
                    { name_of_company: { [Op.iLike]: `%${search}%` } },
                    { isin_number:     { [Op.iLike]: `%${search}%` } },
                ],
              }
            : {};

        const { count, rows } = await Security.findAndCountAll({
            where,
            order: [['symbol', 'ASC']],
            limit:  PAGE_SIZE,
            offset,
        });

        return reply.send({
            data:       rows,
            total:      count,
            page:       pageNum,
            totalPages: Math.ceil(count / PAGE_SIZE),
        });
    });

    // POST /api/securities
    fastify.post('/api/securities', async (request, reply) => {
        const body = request.body as {
            symbol:          string;
            name_of_company: string;
            series:          string;
            isin_number:     string;
            exchange?:        string;
            date_of_listing?: string | null;
            paid_up_value?:   number | null;
            market_lot?:      number | null;
            face_value?:      number | null;
        };

        const { symbol, name_of_company, series, isin_number } = body;

        if (!symbol?.trim() || !name_of_company?.trim() || !series?.trim() || !isin_number?.trim()) {
            return reply.status(400).send({ error: 'symbol, name_of_company, series and isin_number are required' });
        }

        const exchange = body.exchange === 'BSE' ? 'BSE' : 'NSE';

        try {
            const security = await Security.create({
                symbol:          symbol.trim().toUpperCase(),
                name_of_company: name_of_company.trim(),
                series:          series.trim().toUpperCase(),
                isin_number:     isin_number.trim().toUpperCase(),
                exchange,
                date_of_listing: body.date_of_listing || null,
                paid_up_value:   body.paid_up_value != null ? Math.trunc(Number(body.paid_up_value)) : null,
                market_lot:      body.market_lot     != null ? Math.trunc(Number(body.market_lot))     : null,
                face_value:      body.face_value     != null ? Math.trunc(Number(body.face_value))     : null,
            });
            return reply.status(201).send({ data: security });
        } catch (err: any) {
            if (err?.name === 'SequelizeUniqueConstraintError') {
                return reply.status(409).send({ error: 'A security with this symbol or ISIN already exists' });
            }
            throw err;
        }
    });

    // DELETE /api/securities/:id
    fastify.delete('/api/securities/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const security = await Security.findByPk(parseInt(id, 10));
        if (!security) {
            return reply.status(404).send({ error: 'Security not found' });
        }
        await security.destroy();
        return reply.send({ success: true });
    });
}
