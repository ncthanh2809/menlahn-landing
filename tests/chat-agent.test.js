const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const {
  handler,
  _internals: {
    validatePhoneVN,
    validateOrderInput,
    calculateOrderQuote,
    createSepayOrder,
    parseQtyIntent,
    fallbackAgentReply,
    runGeminiAgent
  }
} = require('../netlify/functions/chat-agent.js');

test('validatePhoneVN accepts standard 10-digit VN numbers and rejects invalid ones', () => {
  assert.equal(validatePhoneVN('0934857201'), true);
  assert.equal(validatePhoneVN('+84 909 123 456'), true);
  assert.equal(validatePhoneVN('012345'), false);
  assert.equal(validatePhoneVN('0281234567'), false);
});

test('calculateOrderQuote computes accurate subtotal and 2x500ml savings tip', () => {
  const q1 = calculateOrderQuote({ qty_500ml: 2, qty_1000ml: 0 });
  assert.equal(q1.subtotal_vnd, 80000);
  assert.match(q1.tip, /70\.000/);

  const q2 = calculateOrderQuote({ qty_500ml: 1, qty_1000ml: 2 });
  assert.equal(q2.subtotal_vnd, 180000);
  assert.equal(q2.total_liters, 2.5);
});

test('parseQtyIntent extracts bottle quantities from natural Vietnamese', () => {
  assert.deepEqual(parseQtyIntent('dat 2 chai 1 lit va 1 chai 500ml'), { qty500: 1, qty1000: 2 });
  assert.deepEqual(parseQtyIntent('cho minh nua lit dung thu'), { qty500: 1, qty1000: 0 });
});

test('fallbackAgentReply handles natural queries without forbidden corporate words', () => {
  const forbidden = /(chuyên gia|chuyển đổi|đột phá|đá gel)/i;
  const queries = [
    'Đặt 2 chai 1 lít giao quận 7',
    'Giá nhiêu vậy shop?',
    'Người tiểu đường uống được không?',
    'Bụng đau dạ dày uống lúc nào?',
    'Chai bị tách lớp nước vàng ở đáy có hư không?'
  ];
  for (const q of queries) {
    const res = fallbackAgentReply(q);
    assert.ok(res.reply && res.reply.length > 30, `Missing reply for ${q}`);
    assert.equal(forbidden.test(res.reply), false, `Forbidden term leaked in reply for: ${q}`);
  }
  const orderReply = fallbackAgentReply('Đặt 2 chai 1 lít');
  assert.equal(orderReply.cta.actionType, 'open_order');
  assert.equal(orderReply.cta.qty1000, 2);
});

test('createSepayOrder validates fields and generates live SePay QR URL', async () => {
  const bad = await createSepayOrder({ customer_name: 'A', phone: '123', address: 'Q1', qty_1000ml: 1 });
  assert.equal(bad.status, 'validation_error');

  let calledUrl = '';
  const mockFetch = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => ({ status: 'success' }) };
  };

  const ok = await createSepayOrder(
    {
      customer_name: 'Chị Lan',
      phone: '0909123456',
      address: '123 Nguyễn Thị Minh Khai, Quận 1, TP.HCM',
      qty_500ml: 1,
      qty_1000ml: 1
    },
    mockFetch
  );
  assert.equal(ok.status, 'created');
  assert.match(calledUrl, /script\.google\.com\/macros/);
  assert.equal(ok.orderCard.amount, 110000);
  assert.match(ok.orderCard.qr_url, /^https:\/\/qr\.sepay\.vn\/img\?acc=SEPNH15810&bank=OCB&amount=110000&des=ML/);
});

test('runGeminiAgent executes tool call loop to create live SePay order card', async () => {
  let step = 0;
  const mockFetch = async (url) => {
    if (url.includes('generativelanguage.googleapis.com')) {
      step++;
      if (step === 1) {
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: 'create_sepay_order',
                        args: {
                          customer_name: 'Chị Thảo',
                          phone: '0912345678',
                          address: '45 Lê Lợi, Quận 1, TP.HCM',
                          qty_1000ml: 2
                        }
                      }
                    }
                  ]
                }
              }
            ]
          })
        };
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Dạ Men Lành đã tạo đơn 2x Chai 1 Lít (140.000đ) giúp chị Thảo rồi ạ! Chị quét mã QR bên dưới nha.'
                  }
                ]
              }
            }
          ]
        })
      };
    }
    return { ok: true, json: async () => ({ status: 'success' }) };
  };

  const out = await runGeminiAgent(
    'Đặt giúp chị Thảo 2 chai 1 lít tới 45 Lê Lợi Q1, sđt 0912345678',
    [],
    'fake-gemini-key',
    mockFetch
  );
  assert.equal(out.mode, 'gemini_agent');
  assert.ok(out.orderCard, 'Expected orderCard from Gemini tool call');
  assert.equal(out.orderCard.amount, 140000);
});

test('handler serves CORS OPTIONS and processes POST cleanly without API key', async () => {
  const opt = await handler({ httpMethod: 'OPTIONS' });
  assert.equal(opt.statusCode, 204);

  const post = await handler({
    httpMethod: 'POST',
    body: JSON.stringify({ message: 'Giá chai 1 lít nhiêu bạn?' })
  });
  assert.equal(post.statusCode, 200);
  const parsed = JSON.parse(post.body);
  assert.match(parsed.reply, /70\.000đ/);
});

test('index.html chatbot markup, accessibility, IME guard, and inline JS syntax are valid', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes('<button type="button" class="chatbot-launcher" id="chatbotLauncher"'), 'Launcher must be native button');
  assert.ok(html.includes('aria-expanded="false" aria-controls="chatbotWindow"'), 'Launcher missing aria-expanded/aria-controls');
  assert.ok(html.includes('aria-live="polite"'), 'Chat messages missing polite live region');
  assert.ok(html.includes('isComposing'), 'Missing IME isComposing guard on chat input');
  assert.ok(html.includes('/.netlify/functions/chat-agent'), 'Missing chat-agent endpoint integration');

  const scriptBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scriptBlocks.length >= 1);
  for (const code of scriptBlocks) {
    new vm.Script(code);
  }
});
