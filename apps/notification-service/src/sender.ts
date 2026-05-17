import { channel } from './index';
import { ConsumeMessage } from 'amqplib';
const { Notification } = require('@ascend/db');
import sgMail from '@sendgrid/mail';
import twilio from 'twilio';

// Configure external providers
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

let twilioClient: twilio.Twilio | null = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

const MAX_RETRIES = 3;

export async function startConsumers() {
    if (!channel) return;

    // Prefetch for load balancing
    await channel.prefetch(5);

    const handleMessage = (channelName: string, handler: (msg: any) => Promise<void>) => {
        return async (msg: ConsumeMessage | null) => {
            if (!msg) return;

            try {
                const content = JSON.parse(msg.content.toString());
                await handler(content);
                channel.ack(msg);
            } catch (err) {
                console.error('Error processing message from %s:', channelName, err);

                // Manual retry logic
                const headers = msg.properties.headers || {};
                const retryCount = (headers['x-retry-count'] || 0) + 1;

                if (retryCount <= MAX_RETRIES) {
                    console.log(`Retrying message. Attempt ${retryCount}`);

                    // Exponential backoff
                    const delay = Math.pow(2, retryCount) * 1000;
                    setTimeout(() => {
                        channel.sendToQueue(`notification.${channelName}`, msg.content, {
                            headers: { ...headers, 'x-retry-count': retryCount }
                        });
                        channel.ack(msg); // Ack original to replace it with new one
                    }, delay);
                } else {
                    console.log(`Max retries reached. Nacking message to DLX.`);
                    // Nack with requeue=false pushes to DLX
                    channel.nack(msg, false, false);
                }
            }
        };
    };

    channel.consume('notification.in-app', handleMessage('in-app', async (content) => {
        // Persist Notification row
        await Notification.create({
            user_id: content.user_id,
            alert_id: content.alert_id,
            message: content.message
        });

        // HTTP call to /internal/notification-push
        const dashboardUrl = process.env.DASHBOARD_SERVICE_URL || 'http://localhost:3002';
        const response = await fetch(`${dashboardUrl}/internal/notification-push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': process.env.INTERNAL_SECRET || 'super-secret-internal'
            },
            body: JSON.stringify({
                userId: content.user_id,
                notification: {
                    alert_id: content.alert_id,
                    message: content.message,
                    timestamp: new Date().toISOString()
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Dashboard push failed: ${response.status}`);
        }
    }));

    channel.consume('notification.email', handleMessage('email', async (content) => {
        if (!process.env.SENDGRID_API_KEY) {
            console.log('Skipping email notification, SENDGRID_API_KEY absent.');
            return;
        }

        // Ideally we would fetch user's email, hardcoded for now due to decoupled payload
        const emailMsg = {
            to: process.env.DEBUG_EMAIL || 'test@example.com',
            from: 'alerts@stockportal.com',
            subject: 'StockPortal Alert Triggered',
            text: content.message,
            html: `<strong>${content.message}</strong>`,
        };
        await sgMail.send(emailMsg);
    }));

    channel.consume('notification.sms', handleMessage('sms', async (content) => {
        if (!twilioClient) {
            console.log('Skipping SMS notification, Twilio config absent.');
            return;
        }

        await twilioClient.messages.create({
            body: content.message,
            from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
            to: process.env.DEBUG_PHONE || '+0987654321'
        });
    }));
}
