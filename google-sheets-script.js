/**
 * =========================================================================
 * MEN LÀNH — GOOGLE APPS SCRIPT ĐỒNG BỘ DỮ LIỆU KHẢO SÁT VÀO GOOGLE SHEETS
 * =========================================================================
 * 
 * HƯỚNG DẪN 3 BƯỚC ĐỂ BẬT GOOGLE SHEETS TỰ ĐỘNG:
 * 
 * BƯỚC 1: TẠO FILE GOOGLE SHEETS
 * 1. Truy cập https://sheets.new để tạo một trang tính Google mới.
 * 2. Đặt tên file: "Khách Hàng Men Lành".
 * 3. Ở Hàng 1 (Tiêu đề cột), nhập lần lượt:
 *    - Cột A1: Thời gian gửi
 *    - Cột B1: Tên khách hàng
 *    - Cột C1: Số điện thoại / Zalo
 *    - Cột D1: Nhu cầu cải thiện
 *    - Cột E1: Đối tượng sử dụng
 *    - Cột F1: Dung tích muốn thử
 * 
 * BƯỚC 2: DÁN ĐOẠN CODE DƯỚI ĐÂY VÀO APPS SCRIPT
 * 1. Trên thanh menu Google Sheets, bấm: "Tiện ích mở rộng" (Extensions) > "Apps Script".
 * 2. Xóa toàn bộ nội dung mặc định trong ô soạn thảo.
 * 3. Sao chép và dán toàn bộ đoạn mã trong file này vào.
 * 4. Bấm biểu tượng 💾 Lưu (Ctrl + S).
 * 
 * BƯỚC 3: TRIỂN KHAI THÀNH WEB APP
 * 1. Bấm nút "Triển khai" (Deploy) màu xanh ở góc trên bên phải > chọn "Tùy chọn triển khai mới" (New deployment).
 * 2. Chọn loại: "Ứng dụng web" (Web app) - biểu tượng bánh răng.
 * 3. Thiết lập:
 *    - Mô tả: "Men Lành Survey Webhook"
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me - địa chỉ gmail của bạn)
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)  <-- BẮT BUỘC ĐỂ SITE GỬI DATA VÀO ĐƯỢC
 * 4. Bấm "Triển khai" (Deploy) > Cấp quyền truy cập (Authorize access) khi Google yêu cầu.
 * 5. Sao chép đường link "URL Ứng dụng web" (dạng: https://script.google.com/macros/s/AKfycb.../exec).
 * 6. Gửi đường link đó lại cho Antigravity để gắn vào web, hoặc tự dán vào thuộc tính data-google-sheet-url="..." trong thẻ <form id="surveyForm"> của file index.html!
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Tránh xung đột khi nhiều người gửi cùng lúc

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = {};

    if (e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        data = e.parameter || {};
      }
    } else if (e.parameter) {
      data = e.parameter;
    }

    var timestamp = data.thoi_gian || Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
    var name = data.ten_khach_hang || data.name || "";
    var phone = "'" + (data.so_dien_thoai_zalo || data.phone || ""); // Thêm dấu ' để Google Sheet giữ số 0 đầu
    var goal = data.nhu_cau_cai_thien || data.goal || "";
    var target = data.doi_tuong_su_dung || data.target_user || "";
    var size = data.dung_tich_muon_thu || data.size_preference || "";

    // Chèn dòng dữ liệu mới vào cuối bảng tính
    sheet.appendRow([timestamp, name, phone, goal, target, size]);

    return ContentService.createTextOutput(JSON.stringify({
      "status": "success",
      "message": "Dữ liệu đã được ghi vào Google Sheets!",
      "row": sheet.getLastRow()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      "status": "error",
      "message": error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  return ContentService.createTextOutput("✅ Men Lành Survey Webhook đang hoạt động bình thường!").setMimeType(ContentService.MimeType.TEXT);
}
