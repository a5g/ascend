import { User } from '@ascend/db';
const { Alert } = require('@ascend/db');
import { getZerodhaClient } from '@ascend/zerodha';
import { decrypt } from '@ascend/crypto';
import Redis from 'ioredis';
import { channel } from './index';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const LOCK_KEY = 'worker:alert-evaluator:lock';
const LOCK_TTL = 30;

export async function runEvaluator() {
    const acquired = await redis.set(LOCK_KEY, 'LOCKED', 'EX', LOCK_TTL, 'NX');
    if (!acquired) {
        return;
    }

    try {
        const activeAlerts = await Alert.findAll({ where: { active: true } });
        if (activeAlerts.length === 0) return;

        const adminUser = await User.findOne({ where: { role: 'admin' } });
        if (!adminUser || !adminUser.zerodha_access_token) return;

        const accessToken = decrypt(adminUser.zerodha_access_token);
        const zc = await getZerodhaClient(adminUser.id.toString(), accessToken);

        const symbols = [...new Set(activeAlerts.map((a: any) => a.symbol as string))];
        const quotes: any = await zc.getQuote(symbols as string[]);

        const updatePromises: Promise<any>[] = [];

        for (const alert of activeAlerts) {
            const quote = quotes[alert.symbol];
            if (!quote) continue;

            const ltp = quote.last_price;
            let triggered = false;

            if (alert.condition === 'PRICE_ABOVE' && ltp > (alert.threshold || 0)) {
                triggered = true;
            } else if (alert.condition === 'PRICE_BELOW' && ltp < (alert.threshold || 0)) {
                triggered = true;
            } else if (alert.condition === 'PERCENT_CHANGE' && alert.reference_price) {
                const pctChange = Math.abs((ltp - alert.reference_price) / alert.reference_price) * 100;
                if (pctChange >= (alert.threshold || 0)) {
                    triggered = true;
                }
            } else if (alert.condition === 'ORDER_STATUS') {
                // Not fully implemented for quotes, leaving placeholder
            }

            if (triggered) {
                const processTriggeredAlert = async () => {
                    await alert.update({
                        active: false,
                        triggered_at: new Date()
                    });

                    const channels = (alert.channels as string[]) || [];
                    for (const ch of channels) {
                        const queueName = `notification.${ch}`;
                        const payload = Buffer.from(JSON.stringify({
                            alert_id: alert.id,
                            user_id: alert.user_id,
                            message: `Alert triggered for ${alert.symbol}: condition ${alert.condition} met.`
                        }));
                        if(channel) {
                            channel.sendToQueue(queueName, payload);
                        }
                    }
                };
                updatePromises.push(processTriggeredAlert());
            }
        }

        await Promise.all(updatePromises);
    } catch (e) {
        console.error('Error in evaluator run:', e);
    } finally {
        await redis.del(LOCK_KEY);
    }
}

export function startEvaluator() {
    setInterval(runEvaluator, 60 * 1000);
}
