// Netlify Function: /.netlify/functions/chat-agent
// AI Agent tư vấn & chốt đơn SePay trực tiếp trên web Men Lành (https://menlanh.online)

const SEPAY_ORDER_SCRIPT_URL =
  process.env.SEPAY_ORDER_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbwxXoefhH0DLPc_E6HA3wO-fiOASfaTheu8_fpRVMPOHFAkQ8XjoWPKpyHt6FzHFyJW/exec';

const SURVEY_SHEET_URL =
  process.env.GOOGLE_SHEETS_URL ||
  'https://script.google.com/macros/s/AKfycbxhnAJpclTyJQiBqHHoDsRMC0SnSH_v1qM8sIndqixCSzPe_x0a7ws-hcGCmSt4Ka64Xg/exec';

const SEPAY_BANK_CODE = 'OCB';
const SEPAY_BANK_ACC = 'SEPNH15810';
const SEPAY_ACCOUNT_NAME = 'NGUYEN TRANG THANH HUYEN';

const CATALOG = {
  p500: {
    id: 1,
    name: 'Kefir Nguyên Chất 500ml',
    shortName: 'Chai 500ml',
    price: 40000,
    note: 'Hợp uống thử làm quen 2–3 ngày (~150ml/ngày)'
  },
  p1000: {
    id: 2,
    name: 'Kefir Nguyên Chất 1 Lít (1.000ml)',
    shortName: 'Chai 1 Lít',
    price: 70000,
    note: 'Tiết kiệm nhất & bán chạy nhất — đủ dùng 5–7 ngày hoặc cả gia đình'
  }
};

const SYSTEM_PROMPT = `Bạn là trợ lý tư vấn mẻ tươi của thương hiệu Sữa Chua Kefir Men Lành (https://menlanh.online) tại TP. Hồ Chí Minh.

NGUYÊN TẮC BẮT BUỘC VỀ GIỌNG VĂN (BRAND VOICE):
- Xưng "tụi mình" (hoặc "Men Lành"), gọi khách là "bạn" (hoặc "anh/chị" nếu khách tự xưng trước).
- Giọng văn mộc mạc, ấm áp, chân thành, nhẹ nhàng ("Chậm mà lành"). Trả lời ngắn gọn, chia ý rõ ràng dễ đọc trên điện thoại.
- TỪ CẤM TUYỆT ĐỐI: không dùng các từ "chuyên gia", "chuyển đổi", "đột phá", không nói giọng hành chính ("kính chào quý khách"), không thổi phồng chữa bách bệnh.
- RÀNG BUỘC DỮ LIỆU THẬT (CHỈ NÓI ĐÚNG SỰ THẬT):
  1. Chỉ bán 2 sản phẩm vị Nguyên Chất:
     - Chai 500ml: 40.000đ
     - Chai 1 Lít (1.000ml): 70.000đ
     (Tuyệt đối KHÔNG chào bán "Kefir Mật Ong" như sản phẩm có sẵn.)
  2. Quy trình & giá trị lõi: Lên men chậm 20–24 giờ từ hạt nấm Kefir giống Tây Tạng sống & 100% sữa tươi thanh trùng sạch; 30–50+ chủng lợi khuẩn & nấm men sống; phân giải 99% lactose; 3 KHÔNG: không chất bảo quản, không đường tinh luyện/hóa học, không chất làm dày.
  3. Bảo quản & hiện tượng tự nhiên: Ngăn mát tủ lạnh 2°C–6°C được 10–14 ngày (ngon nhất 5–7 ngày đầu). Độ cồn sinh học tự nhiên rất nhỏ ~0.1%–0.5% như trái chuối chín. Nếu thấy lớp nước vàng trong (Whey Kefir) tách dưới đáy thì chỉ cần lắc đều trước khi rót.
  4. Cách uống êm bụng: Người mới uống 50–100ml/ngày trong 3 ngày đầu sau bữa ăn sáng 15–30 phút (tránh lúc đói cồn cào), từ ngày 4 tăng 100–150ml/ngày. Bé từ 1 tuổi trở lên và mẹ bầu đều dùng tốt. Có thể mix thêm 1 thìa mật ong hoặc xay chuối/xoài/bơ nếu thích ngọt dịu.
  5. Giao hàng: Giao lạnh hỏa tốc trong ngày tại TP. Hồ Chí Minh (KHÔNG hứa "kèm đá gel"). Phí ship hỏa tốc báo theo quận qua Zalo 093 48 57 201 hoặc thanh toán cho shipper khi nhận; đặt chai 1 Lít hoặc rủ đặt chung 2–3 chai sẽ tối ưu phí ship.
  6. Hotline/Zalo trực tiếp: 093 48 57 201 | Email: hello@menlanh.online.

QUY TẮC DÙNG CÔNG CỤ (TOOLS):
- Khi khách hỏi giá, muốn tính tiền nhiều chai hoặc hỏi combo: gọi \`calculate_order_quote\`.
- Khi khách muốn đặt hàng nhưng chưa đủ thông tin (cần: Tên, SĐT Việt Nam 10 số, Địa chỉ giao ở TP.HCM, Số lượng chai): hỏi ngắn gọn phần còn thiếu hoặc mời bấm nút "Mở form đặt nhanh".
- Khi khách đã cung cấp ĐỦ Tên + SĐT hợp lệ + Địa chỉ TP.HCM + Số lượng chai: gọi ngay \`create_sepay_order\` để tạo mã đơn ML và trả mã QR chuyển khoản SePay ngay trong khung chat.
- Nếu khách ngại đặt ngay nhưng muốn để lại SĐT/tên để tư vấn thêm: gọi \`save_consultation_lead\`.`;

function normalizeVi(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function validatePhoneVN(phone) {
  const cleaned = String(phone || '').replace(/[\s.\-()]/g, '');
  return /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(cleaned);
}

function validateOrderInput(args) {
  const customerName = String(args?.customer_name || '').trim();
  const phone = String(args?.phone || '').trim();
  const address = String(args?.address || '').trim();
  const email = String(args?.email || '').trim();
  const note = String(args?.note || '').trim();
  const qty500 = Math.max(0, Math.round(Number(args?.qty_500ml || 0)));
  const qty1000 = Math.max(0, Math.round(Number(args?.qty_1000ml || 0)));

  if (qty500 + qty1000 <= 0) {
    return { ok: false, error: 'Cần chọn ít nhất 1 chai 500ml hoặc 1 Lít.' };
  }
  if (customerName.length < 2) {
    return { ok: false, error: 'Thiếu tên người nhận (ít nhất 2 ký tự).' };
  }
  if (!validatePhoneVN(phone)) {
    return { ok: false, error: 'Số điện thoại chưa đúng định dạng Việt Nam (10 số bắt đầu 03, 05, 07, 08, 09).' };
  }
  if (address.length < 5) {
    return { ok: false, error: 'Thiếu địa chỉ giao hàng cụ thể tại TP.HCM.' };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: 'Email chưa đúng định dạng.' };
  }

  return {
    ok: true,
    data: { customerName, phone, address, email, note, qty500, qty1000 }
  };
}

function calculateOrderQuote(args) {
  const qty500 = Math.max(0, Math.round(Number(args?.qty_500ml || 0)));
  const qty1000 = Math.max(0, Math.round(Number(args?.qty_1000ml || 0)));
  const subtotal = qty500 * CATALOG.p500.price + qty1000 * CATALOG.p1000.price;
  const totalLiters = qty500 * 0.5 + qty1000 * 1.0;

  let tip = 'Giao lạnh hỏa tốc trong ngày tại TP.HCM.';
  if (qty500 >= 2 && qty1000 === 0) {
    tip = `Mẹo nhỏ: ${qty500} chai 500ml là ${subtotal.toLocaleString('vi-VN')}đ; nếu lấy chai 1 Lít (70.000đ/chai) sẽ tiết kiệm được 10.000đ mỗi lít bạn nha.`;
  } else if (qty1000 >= 2) {
    tip = 'Đặt 2 chai 1 Lít rất kinh tế cho cả nhà uống suốt tuần và tối ưu phí ship hỏa tốc trong ngày ạ.';
  }

  return {
    qty_500ml: qty500,
    qty_1000ml: qty1000,
    total_liters: totalLiters,
    subtotal_vnd: subtotal,
    subtotal_formatted: subtotal.toLocaleString('vi-VN') + 'đ',
    shipping_note: 'Phí ship hỏa tốc TP.HCM báo theo quận qua Zalo 093 48 57 201 hoặc gửi trực tiếp shipper khi nhận hàng.',
    tip
  };
}

function buildQrUrl(orderCode, amount) {
  return `https://qr.sepay.vn/img?acc=${encodeURIComponent(SEPAY_BANK_ACC)}&bank=${encodeURIComponent(SEPAY_BANK_CODE)}&amount=${amount}&des=${encodeURIComponent(orderCode)}`;
}

async function createSepayOrder(args, fetchImpl = fetch) {
  const checked = validateOrderInput(args);
  if (!checked.ok) {
    return { status: 'validation_error', error: checked.error };
  }

  const { customerName, phone, address, email, note, qty500, qty1000 } = checked.data;
  const amount = qty500 * CATALOG.p500.price + qty1000 * CATALOG.p1000.price;
  const itemParts = [];
  if (qty500 > 0) itemParts.push(`${qty500}x Chai 500ml`);
  if (qty1000 > 0) itemParts.push(`${qty1000}x Chai 1 Lít`);
  const itemsLabel = itemParts.join(', ');
  const orderCode = 'ML' + Date.now().toString().slice(-5) + Math.floor(Math.random() * 10);

  const payload = {
    action: 'create_order',
    order_code: orderCode,
    customer_name: customerName,
    email,
    phone,
    address,
    items: itemsLabel,
    amount,
    note: `[Chat AI Web]${email ? ' Email: ' + email : ''}${note ? ' | ' + note : ''}`
  };

  let sheetSynced = false;
  try {
    await fetchImpl(SEPAY_ORDER_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    sheetSynced = true;
  } catch (err) {
    console.warn('SePay order webhook warning:', err.message);
  }

  const qrUrl = buildQrUrl(orderCode, amount);
  const orderCard = {
    order_code: orderCode,
    customer_name: customerName,
    phone,
    address,
    items: itemsLabel,
    qty_500ml: qty500,
    qty_1000ml: qty1000,
    amount,
    amount_formatted: amount.toLocaleString('vi-VN') + 'đ',
    qr_url: qrUrl,
    bank_code: SEPAY_BANK_CODE,
    bank_name: 'OCB (Phương Đông)',
    account_number: SEPAY_BANK_ACC,
    account_name: SEPAY_ACCOUNT_NAME,
    sepay_script_url: SEPAY_ORDER_SCRIPT_URL,
    sheet_synced: sheetSynced
  };

  return {
    status: 'created',
    orderCard
  };
}

async function saveConsultationLead(args, fetchImpl = fetch) {
  const name = String(args?.customer_name || '').trim();
  const phone = String(args?.phone || '').trim();
  const need = String(args?.need || 'Tư vấn mẻ tươi qua web chat').trim();
  const preferredSize = String(args?.preferred_size || 'Chưa chọn').trim();

  if (name.length < 2 || !validatePhoneVN(phone)) {
    return {
      status: 'validation_error',
      error: 'Cần ít nhất tên và số điện thoại Việt Nam hợp lệ (10 số) để tụi mình liên hệ lại nhé.'
    };
  }

  const payload = {
    ten_khach_hang: name,
    so_dien_thoai_zalo: phone,
    email: String(args?.email || '').trim(),
    nhu_cau_cai_thien: need,
    doi_tuong_su_dung: 'Khách chat trên web',
    dung_tich_muon_thu: preferredSize,
    thoi_gian: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  };

  try {
    await fetchImpl(SURVEY_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return { status: 'saved', customer_name: name, phone };
  } catch (err) {
    return { status: 'saved_local_only', warning: err.message, customer_name: name, phone };
  }
}

function parseQtyIntent(normText) {
  let qty500 = 0;
  let qty1000 = 0;

  const m1000 = normText.match(/(\d+)\s*(?:chai|binh|hop)?\s*(?:1\s*l(?:it)?|1000\s*ml|mot\s*lit)/);
  if (m1000) qty1000 += Number(m1000[1]);
  else if (/\b(1\s*l(?:it)?|1000\s*ml|mot\s*lit|chai\s*lon)\b/.test(normText)) qty1000 += 1;

  const m500 = normText.match(/(\d+)\s*(?:chai|binh|hop)?\s*(?:500\s*ml|nua\s*lit|0[.,]5\s*l)/);
  if (m500) qty500 += Number(m500[1]);
  else if (/\b(500\s*ml|nua\s*lit|chai\s*nho)\b/.test(normText)) qty500 += 1;

  if (qty500 === 0 && qty1000 === 0) {
    const mGeneric = normText.match(/\bdat\s*(\d+)\s*chai\b/);
    if (mGeneric) qty1000 = Number(mGeneric[1]);
  }

  return { qty500: Math.min(20, qty500), qty1000: Math.min(20, qty1000) };
}

function fallbackAgentReply(message) {
  const norm = normalizeVi(message);
  const { qty500, qty1000 } = parseQtyIntent(norm);

  if (
    qty500 > 0 ||
    qty1000 > 0 ||
    /\b(dat|mua|order|chot|lay|giao|ship|me tuoi)\b/.test(norm)
  ) {
    const q500 = qty500 > 0 ? qty500 : qty1000 === 0 ? 0 : 0;
    const q1000 = qty1000 > 0 ? qty1000 : qty500 === 0 ? 1 : 0;
    const quote = calculateOrderQuote({ qty_500ml: q500, qty_1000ml: q1000 });
    const hasCustomQty = qty500 > 0 || qty1000 > 0;
    const labelItems = [
      q500 > 0 ? `${q500}x 500ml` : '',
      q1000 > 0 ? `${q1000}x 1 Lít` : ''
    ]
      .filter(Boolean)
      .join(' + ');

    const text = hasCustomQty
      ? `Dạ tụi mình tính nhanh giúp bạn: **${labelItems}** có tổng tiền sữa là **${quote.subtotal_formatted}** ạ! 🌿\n\n${quote.tip}\n\nĐể tụi mình tạo đơn và hiện mã QR SePay luôn, bạn bấm nút đặt nhanh bên dưới **hoặc nhắn ngay 3 thông tin** theo mẫu: *Tên + SĐT + Địa chỉ TP.HCM* nhé!`
      : `Dạ hôm nay Men Lành đang có mẻ Kefir tươi mới ủ xong, vị thanh êm dịu lắm ạ! 🌿\n\n• **Chai 500ml:** 40.000đ\n• **Chai 1 Lít:** 70.000đ *(tiết kiệm nhất)*\n\nTụi mình giao lạnh hỏa tốc trong ngày tại TP.HCM. Bạn bấm nút đặt ngay bên dưới để chọn số lượng & quét QR SePay, hoặc nhắn tụi mình **số lượng + Tên + SĐT + Địa chỉ** để tụi mình lên đơn ngay tại đây nhé!`;

    return {
      reply: text,
      mode: 'smart_fallback',
      cta: {
        title: hasCustomQty ? `🛒 Đặt ${labelItems} (${quote.subtotal_formatted})` : '🛒 Đặt mẻ tươi & Quét QR SePay',
        desc: 'Tạo đơn nhanh 20 giây, thanh toán chuyển khoản QR tự động xác nhận sau 5–10 giây:',
        btnText: hasCustomQty ? `Đặt ${labelItems} (${quote.subtotal_formatted}) →` : 'Mở bảng đặt hàng & QR SePay →',
        actionType: 'open_order',
        qty500: q500,
        qty1000: q1000,
        zaloText: '💬 Hoặc nhắn Zalo: 093 48 57 201 →'
      }
    };
  }

  if (/\b(gia|bao nhieu|nhieu tien|dung tich|size|loai)\b/.test(norm)) {
    return {
      mode: 'smart_fallback',
      reply:
        'Dạ Men Lành hiện có 2 dung tích Kefir Nguyên Chất ủ tươi mỗi ngày ạ:\n\n' +
        '• **Chai 500ml — 40.000đ:** Vừa vặn cho 1 người uống thử làm quen 2–3 ngày (~150ml/ngày).\n' +
        '• **Chai 1 Lít (1.000ml) — 70.000đ:** *(Tiết kiệm & bán chạy nhất)* — Đủ dùng 5–7 ngày hoặc cho cả gia đình.\n\n' +
        'Bạn muốn thử chai 500ml hay lấy chai 1 Lít tiết kiệm luôn ạ?',
      cta: {
        title: '🌱 Đặt mẻ tươi chiều nay',
        desc: 'Chọn dung tích và nhận mã QR thanh toán SePay ngay tại đây:',
        btnText: '🛒 Đặt hàng & Hiện mã QR →',
        actionType: 'open_order',
        qty500: 0,
        qty1000: 1
      }
    };
  }

  if (/\b(phi ship|giao hang|hoa toc|quan|hcm|sai gon|tinh|ha noi|binh duong)\b/.test(norm)) {
    return {
      mode: 'smart_fallback',
      reply:
        'Dạ vì Kefir Men Lành là **men sống 100% không chất bảo quản**, tụi mình giao lạnh hỏa tốc trong ngày tại **TP. Hồ Chí Minh** để sữa giữ trọn độ thanh tươi ạ.\n\n' +
        'Phí ship tính theo khoảng cách quận qua ứng dụng giao hàng (tụi mình nhắn Zalo xác nhận phí & khung giờ giao trước khi gửi, hoặc rủ đồng nghiệp lấy 2–3 chai sẽ tối ưu phí ship lắm ạ!).'
    };
  }

  if (/\b(tieu duong|duong|ngot|eat clean|giam can|beo)\b/.test(norm)) {
    return {
      mode: 'smart_fallback',
      reply:
        'Dạ Kefir Men Lành theo cam kết **3 KHÔNG**: hoàn toàn **không thêm đường tinh luyện**, không đường hóa học và không chất làm dày ạ! 🌿\n\n' +
        'Trong 20–24 giờ lên men, hạt nấm đã tiêu hóa gần hết (99%) lượng đường lactose tự nhiên trong sữa tươi nên vị thanh dịu nhẹ bụng. Nếu người dùng có bệnh nền tiểu đường đang kiêng nghiêm ngặt, bạn cứ bắt đầu thử từ 50ml sau bữa ăn và tham khảo thêm ý kiến bác sĩ điều trị nhé!'
    };
  }

  if (/\b(da day|trao nguoc|bao tu|dai trang|xot ruot|dau bung|day hoi|tao bon)\b/.test(norm)) {
    return {
      mode: 'smart_fallback',
      reply:
        'Dạ người bị trào ngược, đau dạ dày, đại tràng hay đầy hơi lại rất hợp uống Kefir dịu độ chua như Men Lành bạn nha! 🌿\n\n' +
        '**Cách uống êm bụng nhất:**\n' +
        '• 3 ngày đầu: uống **50–100ml/ngày** sau bữa ăn sáng **15–30 phút** (không uống khi bụng đói cồn cào).\n' +
        '• Từ ngày thứ 4: tăng lên **100–150ml/ngày**. Lợi khuẩn sống sẽ giúp bụng êm dần và đi ngoài nhẹ nhàng hơn ạ!'
    };
  }

  if (/\b(lactose|sua bo|sua tuoi|tieu chay|soi bung|di ung)\b/.test(norm)) {
    return {
      mode: 'smart_fallback',
      reply:
        'Dạ bạn yên tâm nha! Người hay bị sôi bụng khi uống sữa bò tươi thường do thiếu men tiêu hóa đường Lactose.\n\n' +
        'Khi ủ 20–24 giờ, hạt nấm Kefir đã **phân giải tới 99% đường Lactose** thành axit lactic dịu nhẹ rồi, nên hầu hết khách không dung nạp lactose uống Men Lành vẫn thấy bụng êm ru ạ!'
    };
  }

  if (/\b(be|tre em|con nit|me bau|sau sinh|nguoi gia|ong ba)\b/.test(norm)) {
    return {
      mode: 'smart_fallback',
      reply:
        'Dạ **bé từ 1 tuổi trở lên**, mẹ bầu, mẹ sau sinh và người lớn tuổi đều dùng được rất tốt ạ! 👶🌿\n\n' +
        'Mẻ tươi nhà tụi mình vị chua thanh dịu (độ cồn tự nhiên siêu nhỏ ~0.1–0.5% như chuối chín). Với bé nhỏ, mẹ có thể trộn 50ml Kefir với chuối chín, xoài hoặc xíu mật ong là bé rất thích mà phân lại mềm xốp hơn nhiều ạ!'
    };
  }

  if (/\b(chua|kho uong|vi|ngon|cach uong|uong luc nao|mix)\b/.test(norm)) {
    return {
      mode: 'smart_fallback',
      reply:
        'Dạ tụi mình hiểu nhiều bạn từng uống Kefir nơi khác bị chua gắt nên ngại lắm! 😅\n\n' +
        'Men Lành ủ mẻ tươi thủ công mỗi ngày và canh dừng đúng lúc **chín tới** nên vị chỉ chua thanh dịu và thơm ngậy nhẹ. Nếu thích ngọt dịu kiểu sinh tố, bạn chỉ cần khuấy thêm 1 thìa mật ong hoặc xay cùng nửa quả chuối/bơ uống sau bữa sáng 15–30 phút là cực kỳ dễ ghiền luôn ạ!'
    };
  }

  if (/\b(bao quan|tu lanh|han dung|bao lau|tach nuoc|nuoc vang|whey|hu|hong)\b/.test(norm)) {
    return {
      mode: 'smart_fallback',
      reply:
        'Dạ Kefir Men Lành bảo quản ngăn mát tủ lạnh **(2°C – 6°C) được 10–14 ngày**, ngon và thanh nhất trong **5–7 ngày đầu** bạn nha.\n\n' +
        '💡 Nếu thấy lớp nước vàng trong tách xuống đáy thì đó là **nước Whey Kefir** giàu protein tự nhiên, không phải bị hư đâu ạ — bạn chỉ cần vặn chặt nắp **lắc đều** trước khi rót là sánh mịn lại ngay!'
    };
  }

  if (/\b(sieu thi|khac gi|kefir la gi|nha lam|re hon|dat)\b/.test(norm)) {
    return {
      mode: 'smart_fallback',
      reply:
        'Dạ điểm khác biệt lớn nhất nằm ở **độ sống và đa dạng của men** bạn ơi:\n\n' +
        '• **Sữa chua siêu thị:** Thường chỉ có 1–2 chủng men công nghiệp, thêm đường tinh luyện & chất làm đặc.\n' +
        '• **Kefir Men Lành:** Lên men chậm từ **hạt nấm Kefir sống** với **30–50+ chủng lợi khuẩn & nấm men**, 100% không đường tinh luyện, chia ra chai 1L (70.000đ) uống 6–7 ngày thì mỗi ngày chỉ tầm 10k–12k thôi ạ!'
    };
  }

  return {
    mode: 'smart_fallback',
    reply:
      'Dạ Men Lành đã nhận được câu hỏi của bạn rồi ạ! ♡\n\n' +
      'Bạn có thể hỏi thêm về **giá/combo**, **cách uống cho dạ dày/trẻ nhỏ**, **giao hàng TP.HCM**, hoặc bấm nút bên dưới để chọn mẻ tươi đặt ngay hay làm khảo sát 30 giây nhé:',
    cta: {
      title: '🌿 Chọn nhanh tại Men Lành',
      desc: 'Đặt mẻ tươi hôm nay (tạo QR SePay ngay) hoặc làm khảo sát nhu cầu 30 giây:',
      btnText: '🛒 Đặt mẻ tươi & Quét QR →',
      actionType: 'open_order',
      qty500: 0,
      qty1000: 1,
      secondaryText: '📋 Hoặc làm khảo sát 30 giây →',
      secondaryAction: 'open_survey',
      zaloText: '💬 Nhắn Zalo: 093 48 57 201 →'
    }
  };
}

const GEMINI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'get_catalog_info',
        description: 'Lấy thông tin giá sản phẩm, hạn dùng, cách bảo quản và giao hàng chính xác của Men Lành.',
        parameters: { type: 'OBJECT', properties: {} }
      },
      {
        name: 'calculate_order_quote',
        description: 'Tính tổng tiền sữa Kefir theo số lượng chai 500ml và chai 1 Lít.',
        parameters: {
          type: 'OBJECT',
          properties: {
            qty_500ml: { type: 'INTEGER', description: 'Số lượng chai 500ml (40.000đ/chai)' },
            qty_1000ml: { type: 'INTEGER', description: 'Số lượng chai 1 Lít (70.000đ/chai)' }
          }
        }
      },
      {
        name: 'create_sepay_order',
        description:
          'Tạo đơn hàng thật trên hệ thống SePay + Google Sheets của Men Lành và trả về mã QR thanh toán. Chỉ gọi khi đã có đủ Tên khách, SĐT Việt Nam 10 số, Địa chỉ giao tại TP.HCM và số lượng >= 1 chai.',
        parameters: {
          type: 'OBJECT',
          properties: {
            customer_name: { type: 'STRING', description: 'Họ tên người nhận' },
            phone: { type: 'STRING', description: 'Số điện thoại / Zalo 10 số Việt Nam' },
            address: { type: 'STRING', description: 'Địa chỉ giao hàng tại TP.HCM' },
            qty_500ml: { type: 'INTEGER', description: 'Số lượng chai 500ml' },
            qty_1000ml: { type: 'INTEGER', description: 'Số lượng chai 1 Lít' },
            email: { type: 'STRING', description: 'Email khách hàng (nếu có)' },
            note: { type: 'STRING', description: 'Ghi chú giờ giao hàng (nếu có)' }
          },
          required: ['customer_name', 'phone', 'address']
        }
      },
      {
        name: 'save_consultation_lead',
        description: 'Lưu thông tin khách hàng cần tư vấn thêm vào Google Sheets của Men Lành.',
        parameters: {
          type: 'OBJECT',
          properties: {
            customer_name: { type: 'STRING', description: 'Tên khách hàng' },
            phone: { type: 'STRING', description: 'Số điện thoại / Zalo' },
            need: { type: 'STRING', description: 'Nhu cầu / tình trạng bụng' },
            preferred_size: { type: 'STRING', description: 'Dung tích quan tâm (500ml hoặc 1 Lít)' }
          },
          required: ['customer_name', 'phone']
        }
      }
    ]
  }
];

async function executeAgentTool(name, args, fetchImpl) {
  if (name === 'get_catalog_info') {
    return {
      products: [CATALOG.p500, CATALOG.p1000],
      storage: 'Ngăn mát 2°C–6°C được 10–14 ngày (ngon nhất 5–7 ngày đầu)',
      delivery: 'Giao lạnh hỏa tốc trong ngày tại TP. Hồ Chí Minh',
      contact_zalo: '093 48 57 201'
    };
  }
  if (name === 'calculate_order_quote') {
    return calculateOrderQuote(args);
  }
  if (name === 'create_sepay_order') {
    return createSepayOrder(args, fetchImpl);
  }
  if (name === 'save_consultation_lead') {
    return saveConsultationLead(args, fetchImpl);
  }
  return { error: `Unknown tool: ${name}` };
}

async function runGeminiAgent(message, history, apiKey, fetchImpl = fetch) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = [];
  for (const h of Array.isArray(history) ? history.slice(-10) : []) {
    if (!h || !h.text) continue;
    contents.push({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(h.text).slice(0, 1200) }]
    });
  }
  contents.push({ role: 'user', parts: [{ text: String(message).slice(0, 1500) }] });

  let orderCard = null;
  let suggestedQuote = null;

  for (let step = 0; step < 4; step++) {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        tools: GEMINI_TOOLS,
        generationConfig: {
          temperature: 0.45,
          maxOutputTokens: 700
        }
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Gemini HTTP ${res.status}`);
    }

    const candidate = data?.candidates?.[0]?.content;
    const parts = candidate?.parts || [];
    const fnCallPart = parts.find((p) => p.functionCall);

    if (!fnCallPart) {
      const replyText = parts
        .filter((p) => typeof p.text === 'string')
        .map((p) => p.text)
        .join('\n')
        .trim();

      const out = {
        mode: 'gemini_agent',
        reply: replyText || fallbackAgentReply(message).reply
      };
      if (orderCard) out.orderCard = orderCard;
      else if (suggestedQuote && suggestedQuote.subtotal_vnd > 0) {
        out.cta = {
          title: `🛒 Đặt nhanh (${suggestedQuote.subtotal_formatted})`,
          desc: 'Bấm để mở bảng đặt hàng điền sẵn số lượng và tạo QR SePay:',
          btnText: `Mở form đặt (${suggestedQuote.subtotal_formatted}) →`,
          actionType: 'open_order',
          qty500: suggestedQuote.qty_500ml,
          qty1000: suggestedQuote.qty_1000ml
        };
      }
      return out;
    }

    contents.push({ role: 'model', parts });

    const fnName = fnCallPart.functionCall.name;
    const fnArgs = fnCallPart.functionCall.args || {};
    const toolResult = await executeAgentTool(fnName, fnArgs, fetchImpl);
    if (fnName === 'create_sepay_order' && toolResult?.status === 'created') {
      orderCard = toolResult.orderCard;
    }
    if (fnName === 'calculate_order_quote') {
      suggestedQuote = toolResult;
    }

    contents.push({
      role: 'user',
      parts: [
        {
          functionResponse: {
            name: fnName,
            response: toolResult
          }
        }
      ]
    });
  }

  return fallbackAgentReply(message);
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const message = String(body.message || '').trim();
  const history = Array.isArray(body.history) ? body.history : [];
  if (!message) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Tin nhắn không được để trống.' }) };
  }

  const geminiKey = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (geminiKey) {
    try {
      const result = await runGeminiAgent(message, history, geminiKey, fetch);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (err) {
      console.warn('Gemini Agent fallback triggered:', err.message);
    }
  }

  const fallback = fallbackAgentReply(message);
  return { statusCode: 200, headers, body: JSON.stringify(fallback) };
};

exports._internals = {
  CATALOG,
  normalizeVi,
  validatePhoneVN,
  validateOrderInput,
  calculateOrderQuote,
  createSepayOrder,
  saveConsultationLead,
  parseQtyIntent,
  fallbackAgentReply,
  runGeminiAgent
};
