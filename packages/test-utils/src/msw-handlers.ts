import { http, HttpResponse } from 'msw';

export const handlers = [
  // OpenAI (ChatGPT engine)
  http.post('https://api.openai.com/v1/chat/completions', () =>
    HttpResponse.json({
      id: 'chatcmpl-test',
      choices: [{ message: { content: 'Test response. See https://example.com' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    }),
  ),
  // Anthropic
  http.post('https://api.anthropic.com/v1/messages', () =>
    HttpResponse.json({
      id: 'msg_test',
      content: [{ type: 'text', text: 'Claude test' }],
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
  ),
  // Gemini
  http.post(/generativelanguage\.googleapis\.com.*generateContent/, () =>
    HttpResponse.json({
      candidates: [{ content: { parts: [{ text: 'Gemini test' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
    }),
  ),
  // Perplexity
  http.post('https://api.perplexity.ai/chat/completions', () =>
    HttpResponse.json({
      choices: [{ message: { content: 'PPLX' } }],
      citations: ['https://example.com/a'],
      usage: { prompt_tokens: 10, completion_tokens: 20 },
    }),
  ),
  // Stripe
  http.post('https://api.stripe.com/v1/checkout/sessions', () =>
    HttpResponse.json({ id: 'cs_test', url: 'https://checkout.stripe.com/test' }),
  ),
  http.post('https://api.stripe.com/v1/billing_portal/sessions', () =>
    HttpResponse.json({ url: 'https://billing.stripe.com/test' }),
  ),
  // WordPress REST
  http.post(/\/wp-json\/wp\/v2\/posts/, () =>
    HttpResponse.json({ id: 123, link: 'https://example.com/?p=123', status: 'publish' }),
  ),
  http.post(/\/wp-json\/wp\/v2\/media/, () =>
    HttpResponse.json({ id: 456, source_url: 'https://example.com/media/img.png' }),
  ),
  // IndexNow
  http.post('https://api.indexnow.org/IndexNow', () => new HttpResponse(null, { status: 200 })),
  // Resend
  http.post('https://api.resend.com/emails', () =>
    HttpResponse.json({ id: 'email_test' }),
  ),
  // Slack
  http.post(/hooks\.slack\.com/, () => new HttpResponse('ok', { status: 200 })),
];
