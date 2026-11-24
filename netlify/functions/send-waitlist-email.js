// Netlify Function: /.netlify/functions/send-waitlist-email
// Gửi chuỗi 3 email chăm sóc tự động Men Lành qua Resend API
// Chế độ thường: Email 1 ngay lập tức | Email 2 (+2 ngày) | Email 3 (+3 ngày)
// Chế độ test (email chứa "+test"): Gửi cả 3 email ngay lập tức

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Men Lành <hello@menlanh.online>';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#F8F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#463528;line-height:1.65;">
  <div style="max-width:580px;margin:24px auto;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid rgba(70,53,40,0.12);">
    <div style="background:#223623;color:#F8F4EC;padding:20px 24px;">
      <div style="font-size:20px;font-weight:700;letter-spacing:0.3px;">men lành</div>
      <div style="font-size:12px;color:#F8D38A;margin-top:2px;">Sữa chua Kefir thủ công · Chậm mà lành</div>
    </div>
    <div style="padding:24px;font-size:15px;">
      ${bodyHtml}
    </div>
    <div style="background:#FAF6EE;padding:16px 24px;font-size:12px;color:#6E5A4B;border-top:1px solid rgba(70,53,40,0.08);">
      <strong>Men Lành — Chậm mà lành</strong><br>
      Website: <a href="https://menlanh.online" style="color:#223623;">https://menlanh.online</a> · Zalo: 093 48 57 201 · TP. Hồ Chí Minh
    </div>
  </div>
</body>
</html>`;
}

async function sendViaResend(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || `Resend HTTP ${res.status}`);
  }
  return data;
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Chưa cấu hình biến môi trường RESEND_API_KEY trên Netlify.' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const email = String(body.email || '').trim();
  const rawName = String(body.name || body.ten_khach_hang || 'bạn').trim() || 'bạn';
  const safeName = escapeHtml(rawName);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Địa chỉ email không hợp lệ.' }) };
  }

  const isTestMode = email.toLowerCase().includes('+test');
  const now = Date.now();
  const day2Iso = new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString();
  const day3Iso = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();

  const email1 = {
    from: FROM_EMAIL,
    to: [email],
    subject: `Chào ${rawName}, tụi mình là Men Lành — cảm ơn bạn đã ghé thăm 🌿`,
    html: wrapHtml('Chào mừng bạn đến với Men Lành', `
      <p>Chào <strong>${safeName}</strong>,</p>
      <p>Cảm ơn bạn đã dành 30 giây điền thông tin để tụi mình hiểu hơn về cái bụng của bạn nhé.</p>
      <p>Tụi mình là <strong>Men Lành</strong> — một gian bếp nhỏ ở TP.HCM chuyên ủ sữa chua <strong>Kefir thủ công</strong> từ hạt nấm Kefir giống Tây Tạng sống và 100% sữa tươi sạch.</p>
      <p>Thật ra, tụi mình không làm hàng công nghiệp để sẵn kho cả tuần đâu. Mỗi ngày tụi mình chỉ ủ những mẻ nhỏ suốt 20–24 giờ, đứng canh đúng "điểm chín tới" để giữ trọn vị chua thanh êm, sánh mịn — uống vào êm ruột chứ không chua gắt xót dạ dày.</p>
      <p>Nguyên tắc của tụi mình đơn giản thôi: <strong>Chậm mà lành.</strong></p>
      <ul>
        <li>Không chất bảo quản.</li>
        <li>Không đường tinh luyện hay đường hóa học.</li>
        <li>Không chất làm dày (gelatin/pectin).</li>
      </ul>
      <p>Trong vài ngày tới, tụi mình sẽ gửi thêm cho bạn 1 ghi chú ngắn rất thật về cách chăm đường ruột nhẹ nhàng cho người bận rộn (không phải email quảng cáo dồn dập đâu, yên tâm nhé).</p>
      <p>Nếu có câu hỏi nào muốn hỏi nhanh, bạn cứ trả lời thẳng email này hoặc nhắn Zalo tụi mình ở số <strong>093 48 57 201</strong> nha.</p>
      <p>Thương mến,<br><strong>Tụi mình ở Men Lành</strong></p>
    `)
  };

  const email2 = {
    from: FROM_EMAIL,
    to: [email],
    subject: 'Vì sao uống sữa chua mỗi ngày mà chiều bụng vẫn ấm ách?',
    ...(isTestMode ? {} : { scheduled_at: day2Iso }),
    html: wrapHtml('Chia sẻ từ gian bếp Men Lành', `
      <p>Chào <strong>${safeName}</strong>,</p>
      <p>Hôm nay tụi mình không bán hàng đâu — chỉ muốn chia sẻ với bạn một chuyện rất nhiều bạn đi làm hay gặp mà ít ai để ý.</p>
      <p>Nhiều bạn nhắn cho tụi mình bảo: <em>"Chiều nào tầm 3–4 giờ bụng mình cũng căng chướng khó chịu, dù ngày nào cũng ăn 1 hũ sữa chua siêu thị."</em></p>
      <p>Thật ra, có 2 lý do đơn giản thôi:</p>
      <p><strong>1. Số lượng chủng lợi khuẩn khác nhau rất xa.</strong><br>
      Sữa chua công nghiệp thông thường chỉ có khoảng 2–3 chủng men cơ bản và thường có thêm đường tinh luyện. Trong khi đó, sữa chua <strong>Kefir lên men chậm từ hạt nấm sống</strong> chứa tới <strong>30–50+ chủng lợi khuẩn &amp; nấm men sống</strong> — đủ khỏe để đi qua axit dạ dày và hỗ trợ làm sạch đường ruột.</p>
      <p><strong>2. Thời điểm uống và độ chua của mẻ men.</strong><br>
      Nếu bạn uống lúc bụng đói meo hoặc uống phải chai Kefir để kho lạnh quá lâu (bị chua gắt), dạ dày sẽ dễ cồn cào.</p>
      <p><strong>Một mẹo nhỏ bạn có thể thử xem ngay tuần này:</strong></p>
      <ul>
        <li>Uống/ăn đồ lên men <strong>sau bữa sáng hoặc bữa trưa 15–30 phút</strong>.</li>
        <li>Nếu bụng vốn nhạy cảm hoặc hay sôi bụng khi uống sữa bò, cứ bắt đầu chậm rãi từ <strong>50–100ml mỗi ngày</strong> trong 3 ngày đầu. Quá trình lên men chậm 20–24 giờ của Kefir đã phân giải tới <strong>99% lactose</strong>, nên bụng yếu vẫn đón nhận rất êm.</li>
      </ul>
      <p>Chăm ruột không cần phức tạp — chỉ cần đúng cách và đều đặn mỗi ngày một chút thôi. Hẹn gặp bạn ở email tiếp theo nhé!</p>
      <p>Thương mến,<br><strong>Tụi mình ở Men Lành</strong></p>
    `)
  };

  const email3 = {
    from: FROM_EMAIL,
    to: [email],
    subject: `Mẻ Kefir tươi mới vừa ra lò — ${rawName} thử 1 chai xem bụng êm cỡ nào nhé 🥛`,
    ...(isTestMode ? {} : { scheduled_at: day3Iso }),
    html: wrapHtml('Mẻ Kefir tươi Men Lành', `
      <p>Chào <strong>${safeName}</strong>,</p>
      <p>Nếu mấy hôm nay bụng bạn vẫn hay đầy hơi xế chiều, hoặc bạn đang tìm một món sữa chua sạch 100% tự nhiên để cả nhà uống mỗi sáng mà không sợ chua gắt — thì mẻ tươi hôm nay của Men Lành đã sẵn sàng rồi nè.</p>
      <p>Tụi mình giữ đúng 2 dung tích gọn gàng, vị <strong>Kefir Nguyên Chất</strong> sánh mịn, thanh dịu:</p>
      <ul>
        <li><strong>Chai 500ml — 40.000đ:</strong> Gọn nhẹ để bạn dùng thử 2–3 ngày xem vị và độ êm bụng có hợp gu không.</li>
        <li><strong>Chai 1 Lít (1.000ml) — 70.000đ:</strong> Tiết kiệm nhất cho cả tuần hoặc gia đình 2–4 người.</li>
      </ul>
      <p>Tất cả đều ủ mới mỗi ngày từ hạt nấm sống &amp; 100% sữa tươi sạch, bảo quản ngăn mát 2°C–6°C (10–14 ngày, ngon nhất 5–7 ngày đầu) và <strong>giao lạnh hỏa tốc trong ngày tại TP. Hồ Chí Minh</strong>.</p>
      <p style="text-align:center;margin:24px 0;">
        <a href="https://menlanh.online/thanh-toan" style="display:inline-block;background:#D49226;color:#FFFFFF;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:50px;">Đặt mẻ tươi &amp; thanh toán QR →</a>
      </p>
      <p>Đừng vội đặt nhiều, cứ thử xem 1 chai trước để cảm nhận cái bụng nhẹ tênh mỗi sáng nha. Cần tư vấn thêm cho bé nhỏ hay người lớn tuổi trong nhà, cứ nhắn Zalo <strong>093 48 57 201</strong> bất cứ lúc nào!</p>
      <p>Chúc bạn luôn khỏe ruột và nhẹ lòng,<br><strong>Tụi mình ở Men Lành</strong></p>
    `)
  };

  try {
    const r1 = await sendViaResend(apiKey, email1);
    if (isTestMode) await delay(600);
    const r2 = await sendViaResend(apiKey, email2);
    if (isTestMode) await delay(600);
    const r3 = await sendViaResend(apiKey, email3);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        mode: isTestMode ? 'test_immediate_all_3' : 'scheduled',
        from: FROM_EMAIL,
        sent: [r1.id, r2.id, r3.id]
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: 'error', error: err.message })
    };
  }
};
