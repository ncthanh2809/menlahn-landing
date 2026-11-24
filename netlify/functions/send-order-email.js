// Netlify Function: /.netlify/functions/send-order-email
// Gửi email xác nhận đơn hàng tự động qua Resend API khi Admin tạo đơn mới

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Men Lành <hello@menlanh.online>';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatVND(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + 'đ';
}

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

  const rawApiKey = String(process.env.RESEND_API_KEY || '').trim();
  const apiKey = (rawApiKey.match(/re_[A-Za-z0-9_]+/) || [rawApiKey])[0].replace(/[^\x20-\x7E]/g, '');
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email khách hàng không hợp lệ.' }) };
  }

  const rawName = String(body.customer_name || 'bạn').trim() || 'bạn';
  const orderCode = String(body.order_code || 'ML').trim();
  const items = String(body.items || 'Kefir Nguyên Chất Men Lành').trim();
  const amount = formatVND(body.amount);
  const address = String(body.address || 'TP. Hồ Chí Minh').trim();
  const status = String(body.status || 'Chờ thanh toán').trim();

  const html = `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><title>Xác nhận đơn hàng ${escapeHtml(orderCode)}</title></head>
<body style="margin:0;padding:0;background:#F8F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#463528;line-height:1.65;">
  <div style="max-width:580px;margin:24px auto;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid rgba(70,53,40,0.12);">
    <div style="background:#223623;color:#F8F4EC;padding:20px 24px;">
      <div style="font-size:20px;font-weight:700;">men lành</div>
      <div style="font-size:12px;color:#F8D38A;margin-top:2px;">Xác nhận đơn hàng · Chậm mà lành</div>
    </div>
    <div style="padding:24px;font-size:15px;">
      <p>Chào <strong>${escapeHtml(rawName)}</strong>,</p>
      <p>Cảm ơn bạn đã tin chọn mẻ tươi nhà Men Lành nhé! Tụi mình đã ghi nhận đơn hàng của bạn vào hệ thống:</p>
      <div style="background:#FAF6EE;border-radius:12px;padding:16px;margin:16px 0;border:1px solid rgba(70,53,40,0.1);">
        <div><strong>Mã đơn hàng:</strong> ${escapeHtml(orderCode)}</div>
        <div><strong>Sản phẩm:</strong> ${escapeHtml(items)}</div>
        <div><strong>Tổng tiền sữa:</strong> <span style="color:#D49226;font-weight:700;">${escapeHtml(amount)}</span></div>
        <div><strong>Trạng thái:</strong> ${escapeHtml(status)}</div>
        <div><strong>Địa chỉ nhận hàng:</strong> ${escapeHtml(address)}</div>
      </div>
      <p><strong>Hướng dẫn nhận hàng &amp; bảo quản:</strong></p>
      <ul>
        <li>Tụi mình sẽ chuẩn bị chai Kefir tươi từ ngăn mát và liên hệ qua Zalo/SĐT của bạn để báo cước giao hỏa tốc nội thành TP.HCM &amp; xác nhận khung giờ bạn tiện nhận.</li>
        <li>Khi nhận hàng, bạn cất ngay vào <strong>ngăn mát tủ lạnh 2°C–6°C</strong> nhé (ngon nhất trong 5–7 ngày đầu, bảo quản được 10–14 ngày).</li>
        <li>Nếu thấy chai có lớp nước trong nhẹ phía trên, đó là nước Whey tự nhiên của men sống — chỉ cần lắc nhẹ là sánh mịn lại ngay.</li>
      </ul>
      <p>Cần đổi giờ nhận hay nhắn thêm gì, bạn cứ phản hồi thẳng email này hoặc nhắn Zalo <strong>093 48 57 201</strong> cho tụi mình nha!</p>
      <p>Thương mến,<br><strong>Tụi mình ở Men Lành</strong></p>
    </div>
    <div style="background:#FAF6EE;padding:16px 24px;font-size:12px;color:#6E5A4B;border-top:1px solid rgba(70,53,40,0.08);">
      Website: <a href="https://menlanh.online" style="color:#223623;">https://menlanh.online</a> · Zalo: 093 48 57 201
    </div>
  </div>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `Men Lành đã nhận đơn ${orderCode} của ${rawName} rồi nè 🥛`,
        html
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || `Resend HTTP ${res.status}`);
    }
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ status: 'success', id: data.id, from: FROM_EMAIL })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ status: 'error', error: err.message })
    };
  }
};
