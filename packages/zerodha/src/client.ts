import { KiteConnect } from 'kiteconnect';
import CircuitBreaker from 'opossum';
import PQueue from 'p-queue';

export class ZerodhaTokenExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZerodhaTokenExpiredError';
  }
}

export const getZerodhaClient = async (userId: string, accessToken: string) => {
  if (!accessToken) {
    throw new ZerodhaTokenExpiredError('Zerodha access token is missing or expired.');
  }

  const kc = new KiteConnect({
    api_key: process.env.ZERODHA_API_KEY || 'dummy_api_key',
  });
  kc.setAccessToken(accessToken);
  return kc;
};

// 3 req/sec rate limiter via p-queue
const queue = new PQueue({ intervalCap: 3, interval: 1000, carryoverConcurrencyCount: true });

export const withHoldingsRateLimit = <T>(fn: () => Promise<T>): Promise<T> => {
  return queue.add(fn) as Promise<T>;
};

// circuit breaker configuration for zerodha calls
const circuitBreakerOptions = {
    timeout: 3000, // If our function takes longer than 3 seconds, trigger a failure
    errorThresholdPercentage: 50, // When 50% of requests fail, trip the circuit
    resetTimeout: 30000 // After 30 seconds, try again.
};

export const createCircuitBreaker = (action: (...args: any[]) => Promise<any>) => {
    return new CircuitBreaker(action, circuitBreakerOptions);
}
