/**
 * =========================================================================
 * MEN LÀNH — GOOGLE APPS SCRIPT LƯU ĐƠN HÀNG & NHẬN WEBHOOK SEPAY TỰ ĐỘNG
 * =========================================================================
 * Tự động tạo 2 sheet:
 *  1. "DonHang"         : Lưu đơn đặt hàng từ Website & tự đổi trạng thái khi nhận tiền
 *  2. "LichSuGiaoDich"  : Lưu toàn bộ lịch sử tiền vào từ SePay (chống trùng lặp)
 */

var SHEET_ORDERS = "DonHang";
var SHEET_TXNS = "LichSuGiaoDich";

function getOrCreateSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrderSheet_(ss) {
  return getOrCreateSheet_(ss, SHEET_ORDERS, [
    "Thời gian đặt",
    "Mã đơn hàng",
    "Tên khách hàng",
    "Số điện thoại",
    "Địa chỉ giao",
    "Sản phẩm",
    "Tổng tiền",
    "Trạng thái",
    "Số tiền đã nhận",
    "Thời gian thanh toán",
    "Mã GD SePay",
    "Ghi chú"
  ]);
}

function getTxnSheet_(ss) {
  return getOrCreateSheet_(ss, SHEET_TXNS, [
    "Thời gian ghi nhận",
    "SePay ID",
    "Ngân hàng",
    "Thời gian GD",
    "Số TK",
    "Số tiền vào",
    "Nội dung CK",
    "Mã tham chiếu",
    "Mã đơn khớp"
  ]);
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function nowVN_() {
  return Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
}

/**
 * Xử lý POST:
 * - Từ Website (action === "create_order"): Tạo đơn hàng mới
 * - Từ SePay Webhook: Ghi nhận giao dịch & tự động đổi trạng thái đơn hàng
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);

  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // TRƯỜNG HỢP 1: Website gửi đơn hàng mới
    if (data.action === "create_order") {
      var orderSheet = getOrderSheet_(ss);
      var orderCode = String(data.order_code || ("ML" + Date.now().toString().slice(-6))).toUpperCase();
      var amount = Number(data.amount || 0);

      orderSheet.appendRow([
        nowVN_(),
        orderCode,
        data.customer_name || "",
        "'" + String(data.phone || ""),
        data.address || "",
        data.items || "",
        amount,
        "Chờ thanh toán",
        0,
        "",
        "",
        data.note || ""
      ]);

      return jsonResponse_({
        status: "success",
        order_code: orderCode,
        message: "Đã tạo đơn hàng thành công"
      });
    }

    // TRƯỜNG HỢP 2: SePay gửi Webhook biến động số dư
    if (data.transferType !== undefined || data.transferAmount !== undefined) {
      // Chỉ xử lý giao dịch tiền vào
      if (data.transferType && data.transferType !== "in") {
        return jsonResponse_({ success: true, message: "Ignored outgoing transfer" });
      }

      var txnSheet = getTxnSheet_(ss);
      var sepayId = String(data.id || "");
      var transferAmount = Number(data.transferAmount || 0);
      var content = String(data.content || "");
      var contentUpper = content.toUpperCase();
      var sepayCodeUpper = String(data.code || "").toUpperCase();

      // Chống trùng lặp theo SePay ID
      if (sepayId && txnSheet.getLastRow() > 1) {
        var existingIds = txnSheet.getRange(2, 2, txnSheet.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < existingIds.length; i++) {
          if (String(existingIds[i][0]) === sepayId) {
            return jsonResponse_({ success: true, message: "Duplicate transaction ignored" });
          }
        }
      }

      // Tìm đơn hàng khớp mã trong sheet DonHang (duyệt từ mới nhất trở lên)
      var orderSheet2 = getOrderSheet_(ss);
      var matchedOrderCode = "";
      var lastOrderRow = orderSheet2.getLastRow();

      if (lastOrderRow > 1) {
        var orders = orderSheet2.getRange(2, 1, lastOrderRow - 1, 12).getValues();
        for (var r = orders.length - 1; r >= 0; r--) {
          var rowCode = String(orders[r][1] || "").trim().toUpperCase();
          var rowAmount = Number(orders[r][6] || 0);
          var rowStatus = String(orders[r][7] || "");

          if (!rowCode || rowStatus === "Đã thanh toán") continue;

          if (contentUpper.indexOf(rowCode) !== -1 || (sepayCodeUpper && sepayCodeUpper === rowCode)) {
            matchedOrderCode = rowCode;
            var newStatus = transferAmount >= rowAmount ? "Đã thanh toán" : "Thiếu tiền";
            var sheetRowNum = r + 2;

            orderSheet2.getRange(sheetRowNum, 8).setValue(newStatus);
            orderSheet2.getRange(sheetRowNum, 9).setValue(transferAmount);
            orderSheet2.getRange(sheetRowNum, 10).setValue(data.transactionDate || nowVN_());
            orderSheet2.getRange(sheetRowNum, 11).setValue(data.referenceCode || sepayId);
            break;
          }
        }
      }

      // Ghi log giao dịch vào LichSuGiaoDich
      txnSheet.appendRow([
        nowVN_(),
        sepayId,
        data.gateway || "",
        data.transactionDate || "",
        "'" + String(data.subAccount || data.accountNumber || ""),
        transferAmount,
        content,
        data.referenceCode || "",
        matchedOrderCode
      ]);

      return jsonResponse_({
        success: true,
        matched_order: matchedOrderCode
      });
    }

    return jsonResponse_({ status: "error", message: "Unknown payload" });

  } catch (error) {
    return jsonResponse_({ status: "error", message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Xử lý GET:
 * - ?action=check_order&order_code=ML123456 -> Website kiểm tra đơn đã thanh toán chưa
 * - Mở trực tiếp trên trình duyệt -> Kiểm tra trạng thái hoạt động
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    if (params.action === "check_order" && params.order_code) {
      var targetCode = String(params.order_code).trim().toUpperCase();
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var orderSheet = getOrderSheet_(ss);
      var lastRow = orderSheet.getLastRow();

      if (lastRow > 1) {
        var rows = orderSheet.getRange(2, 1, lastRow - 1, 11).getValues();
        for (var i = rows.length - 1; i >= 0; i--) {
          if (String(rows[i][1] || "").trim().toUpperCase() === targetCode) {
            return jsonResponse_({
              status: "success",
              order_code: targetCode,
              payment_status: rows[i][7],
              amount: Number(rows[i][6] || 0),
              paid_amount: Number(rows[i][8] || 0),
              paid_at: rows[i][9] || ""
            });
          }
        }
      }

      return jsonResponse_({
        status: "not_found",
        order_code: targetCode,
        payment_status: "Không tìm thấy"
      });
    }

    return jsonResponse_({
      status: "ok",
      message: "✅ Men Lành SePay Webhook đang hoạt động!"
    });
  } catch (error) {
    return jsonResponse_({ status: "error", message: error.toString() });
  }
}
