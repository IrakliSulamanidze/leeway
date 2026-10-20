// The part of web-push's API that src/lib/server/push.ts uses, matching
// @types/web-push. Delete this file once `npm install` has added @types/web-push.
declare module "web-push" {
  export interface PushSubscription {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }
  export interface RequestOptions {
    vapidDetails?: { subject: string; publicKey: string; privateKey: string };
    TTL?: number;
    timeout?: number;
  }
  export interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, string>;
  }
  export class WebPushError extends Error {
    statusCode: number;
  }
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: RequestOptions,
  ): Promise<SendResult>;
}
