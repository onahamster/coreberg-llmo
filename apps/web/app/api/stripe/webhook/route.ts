import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { processStripeEvent } from '@coreberg/billing';
import { createServiceSupabase } from '@/lib/supabase/service';

/**
 * POST /api/stripe/webhook
 * Stripe からのイベントを受信し、署名を検証した上で処理する
 *
 * M-7: Stripe webhook エンドポイントが存在しなかったため新規作成
 *      stripe.webhooks.constructEvent() による署名検証を必須とする
 *
 * Cloudflare Workers 環境では raw body の取得に rawBody/text() を使う
 */
export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    console.error('Stripe env vars are not configured');
    return NextResponse.json({ error: 'stripe_not_configured' }, { status: 503 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
    // Cloudflare Workers では fetch ベースの HTTP クライアントを使う
    httpClient: Stripe.createFetchHttpClient(),
  });

  // raw body を取得（署名検証に必要）
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // S-7 修正: stripe.webhooks.constructEvent による署名検証
    // これにより、任意ユーザーが偽のイベントを送信できなくなる
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Stripe webhook signature verification failed:', message);
    return NextResponse.json(
      { error: 'invalid_signature', details: message },
      { status: 400 },
    );
  }

  const sb = createServiceSupabase();

  try {
    const result = await processStripeEvent(sb, event);

    if (result.status === 'error') {
      console.error('processStripeEvent failed', result.error);
      return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
    }

    return NextResponse.json({ received: true, status: result.status });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('Stripe webhook processing error:', message);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

// Next.js が body を自動パースしないよう、raw body を取得するための設定
export const config = {
  api: {
    bodyParser: false,
  },
};
