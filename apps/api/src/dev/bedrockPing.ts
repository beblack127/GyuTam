// task 1.3: 가상 리뷰 2개로 Bedrock InvokeModel 응답 형태와 지연을 확인한다.
// 키, 리뷰 본문, 응답 본문 전체는 출력하지 않는다. 최상위 키, 최종 텍스트 위치, 지연, 토큰 수만 출력한다.
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const region = process.env.AWS_REGION;
const modelId = process.env.BEDROCK_JUDGE_MODEL_ID;
if (!region || !modelId) {
  console.error('missing env: AWS_REGION, BEDROCK_JUDGE_MODEL_ID');
  process.exit(1);
}

const system = '리뷰마다 대가성 여부를 판정하고 JSON만 출력한다. 형식: {"tags":[{"id":"...","stain":"none|certain|suspected","evidence":null}]}';
const user = JSON.stringify({
  reviews: [
    { id: 't-1', text: '업체로부터 제품을 무료로 제공받아 작성한 후기입니다. 가볍고 충전도 빨라요.' },
    { id: 't-2', text: '한 시간 정도 쓰면 뜨거워져서 주머니에 넣기 불안해요.' },
  ],
});

async function call(label: string, extra: Record<string, unknown>): Promise<void> {
  const client = new BedrockRuntimeClient({ region, maxAttempts: 1 });
  const body = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: 800,
    ...extra,
  };
  const started = Date.now();
  try {
    const res = await client.send(
      new InvokeModelCommand({ modelId, contentType: 'application/json', accept: 'application/json', body: JSON.stringify(body) }),
    );
    const ms = Date.now() - started;
    const json = JSON.parse(new TextDecoder().decode(res.body)) as Record<string, any>;
    const message = json.choices?.[0]?.message ?? {};
    const content: unknown = message.content;
    console.log(`[${label}] ok ${ms} ms`);
    console.log(`  top-level keys: ${Object.keys(json).join(', ')}`);
    console.log(`  choices[0].message keys: ${Object.keys(message).join(', ')}`);
    console.log(`  content type: ${typeof content}, length: ${typeof content === 'string' ? content.length : 'n/a'}`);
    console.log(`  content starts with '{': ${typeof content === 'string' && content.trim().startsWith('{')}`);
    console.log(`  usage: ${JSON.stringify(json.usage ?? null)}`);
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number }; message?: string };
    console.log(`[${label}] error ${Date.now() - started} ms: ${e.name} (${e.$metadata?.httpStatusCode ?? '-'}) ${String(e.message ?? '').slice(0, 160)}`);
  }
}

await call('reasoning none + temperature 0', { reasoning_effort: 'none', temperature: 0 });
await call('reasoning none only', { reasoning_effort: 'none' });
