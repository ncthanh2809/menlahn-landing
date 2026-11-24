var ADMIN_PIN = "2026";
var SHEET_ORDERS = "DonHang";
var SHEET_TXNS = "LichSuGiaoDich";
var SHEET_PRODUCTS = "SanPham";
var SHEET_CUSTOMERS = "KhachHang";

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
    "Thời gian đặt", "Mã đơn hàng", "Tên khách hàng", "Số điện thoại",
    "Địa chỉ giao", "Sản phẩm", "Tổng tiền", "Trạng thái",
    "Số tiền đã nhận", "Thời gian thanh toán", "Mã GD SePay", "Ghi chú"
  ]);
}

function getTxnSheet_(ss) {
  return getOrCreateSheet_(ss, SHEET_TXNS, [
    "Thời gian ghi nhận", "SePay ID", "Ngân hàng", "Thời gian GD",
    "Số TK", "Số tiền vào", "Nội dung CK", "Mã tham chiếu", "Mã đơn khớp"
  ]);
}

function getProductSheet_(ss) {
  return getOrCreateSheet_(ss, SHEET_PRODUCTS, [
    "ID", "Tên sản phẩm", "Loại", "Giá", "Mô tả", "Số lượng còn lại", "Ngày tạo"
  ]);
}

function getCustomerSheet_(ss) {
  return getOrCreateSheet_(ss, SHEET_CUSTOMERS, [
    "ID", "Tên khách hàng", "Số điện thoại", "Zalo", "Ngày đăng ký"
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

function nextId_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1;
  var vals = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var maxId = 0;
  for (var i = 0; i < vals.length; i++) {
    var n = Number(vals[i][0] || 0);
    if (n > maxId) maxId = n;
  }
  return maxId + 1;
}

function checkPin_(pin) {
  return String(pin || "") === String(ADMIN_PIN);
}

function readAllProducts_(ss) {
  var sh = getProductSheet_(ss);
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return [];
  var rows = sh.getRange(2, 1, lastRow - 1, 7).getValues();
  var out = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    if (!r[0] && !r[1]) continue;
    out.push({
      id: Number(r[0]),
      name: String(r[1] || ""),
      type: String(r[2] || "physical"),
      price: Number(r[3] || 0),
      description: String(r[4] || ""),
      stock_quantity: (r[5] === "" || r[5] === null || r[5] === undefined) ? null : Number(r[5]),
      created_at: String(r[6] || "")
    });
  }
  return out;
}

function readAllCustomers_(ss) {
  var sh = getCustomerSheet_(ss);
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return [];
  var rows = sh.getRange(2, 1, lastRow - 1, 5).getValues();
  var out = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    if (!r[0] && !r[1]) continue;
    out.push({
      id: Number(r[0]),
      name: String(r[1] || ""),
      phone: String(r[2] || "").replace(/^'/, ""),
      zalo: String(r[3] || "").replace(/^'/, ""),
      registered_at: String(r[4] || "")
    });
  }
  return out;
}

function readAllOrders_(ss) {
  var sh = getOrderSheet_(ss);
  var lastRow = sh.getLastRow();
  if (lastRow <= 1) return [];
  var rows = sh.getRange(2, 1, lastRow - 1, 12).getValues();
  var out = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    if (!r[1] && !r[2]) continue;
    out.push({
      row_index: i + 2,
      order_date: String(r[0] || ""),
      order_code: String(r[1] || ""),
      customer_name: String(r[2] || ""),
      phone: String(r[3] || "").replace(/^'/, ""),
      address: String(r[4] || ""),
      items: String(r[5] || ""),
      amount: Number(r[6] || 0),
      status: String(r[7] || "Chờ thanh toán"),
      paid_amount: Number(r[8] || 0),
      paid_at: String(r[9] || ""),
      sepay_ref: String(r[10] || ""),
      note: String(r[11] || "")
    });
  }
  return out;
}

function findRowByCol_(sheet, colIndex, targetValue) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  var vals = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(targetValue).trim()) {
      return i + 2;
    }
  }
  return -1;
}

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
    var action = String(data.action || "");

    // ---- ADMIN ACTIONS (Yeu cau PIN) ----
    if (action.indexOf("admin_") === 0) {
      if (!checkPin_(data.pin)) {
        return jsonResponse_({ status: "error", error: "Sai mã PIN quản trị." });
      }

      if (action === "admin_save_product") {
        var pSheet = getProductSheet_(ss);
        var pName = String(data.name || "").trim();
        var pType = String(data.type || "physical").trim();
        var pPrice = Math.round(Number(data.price || 0));
        var pDesc = String(data.description || "").trim();
        var rawStock = data.stock_quantity;
        var pStock = "";

        if (!pName) return jsonResponse_({ status: "error", error: "Vui lòng nhập tên sản phẩm." });
        if (["physical", "digital", "service"].indexOf(pType) === -1) {
          return jsonResponse_({ status: "error", error: "Loại sản phẩm không hợp lệ." });
        }
        if (pType === "physical") {
          if (rawStock === "" || rawStock === null || rawStock === undefined) {
            return jsonResponse_({ status: "error", error: "Sản phẩm vật lý bắt buộc nhập số lượng còn lại." });
          }
          pStock = Math.max(0, Math.round(Number(rawStock)));
        } else if (rawStock !== "" && rawStock !== null && rawStock !== undefined) {
          pStock = Math.max(0, Math.round(Number(rawStock)));
        }

        if (data.id) {
          var pRow = findRowByCol_(pSheet, 1, data.id);
          if (pRow === -1) return jsonResponse_({ status: "error", error: "Không tìm thấy sản phẩm." });
          pSheet.getRange(pRow, 2, 1, 5).setValues([[pName, pType, pPrice, pDesc, pStock]]);
        } else {
          var newPid = nextId_(pSheet);
          pSheet.appendRow([newPid, pName, pType, pPrice, pDesc, pStock, nowVN_()]);
        }
        return jsonResponse_({ status: "success" });
      }

      if (action === "admin_delete_product") {
        var pSheetDel = getProductSheet_(ss);
        var pRowDel = findRowByCol_(pSheetDel, 1, data.id);
        if (pRowDel === -1) return jsonResponse_({ status: "error", error: "Không tìm thấy sản phẩm." });
        pSheetDel.deleteRow(pRowDel);
        return jsonResponse_({ status: "success" });
      }

      if (action === "admin_save_customer") {
        var cSheet = getCustomerSheet_(ss);
        var cName = String(data.name || "").trim();
        var cPhone = String(data.phone || "").trim();
        var cZalo = String(data.zalo || "").trim();
        var cReg = String(data.registered_at || "").trim() || nowVN_();

        if (!cName) return jsonResponse_({ status: "error", error: "Vui lòng nhập tên khách hàng." });

        if (data.id) {
          var cRow = findRowByCol_(cSheet, 1, data.id);
          if (cRow === -1) return jsonResponse_({ status: "error", error: "Không tìm thấy khách hàng." });
          cSheet.getRange(cRow, 2, 1, 4).setValues([[cName, cPhone ? "'" + cPhone : "", cZalo ? "'" + cZalo : "", cReg]]);
        } else {
          if (cPhone) {
            var dupRow = findRowByCol_(cSheet, 3, cPhone);
            if (dupRow !== -1) return jsonResponse_({ status: "error", error: "Số điện thoại này đã tồn tại." });
          }
          var newCid = nextId_(cSheet);
          cSheet.appendRow([newCid, cName, cPhone ? "'" + cPhone : "", cZalo ? "'" + cZalo : "", cReg]);
        }
        return jsonResponse_({ status: "success" });
      }

      if (action === "admin_delete_customer") {
        var cSheetDel = getCustomerSheet_(ss);
        var cRowDel = findRowByCol_(cSheetDel, 1, data.id);
        if (cRowDel === -1) return jsonResponse_({ status: "error", error: "Không tìm thấy khách hàng." });
        cSheetDel.deleteRow(cRowDel);
        return jsonResponse_({ status: "success" });
      }

      if (action === "admin_save_order") {
        var oSheet = getOrderSheet_(ss);
        var oCode = String(data.order_code || ("ML" + Date.now().toString().slice(-6))).trim().toUpperCase();
        var oCustName = String(data.customer_name || "").trim();
        var oPhone = String(data.phone || "").trim();
        var oAddress = String(data.address || "").trim();
        var oItems = String(data.items || "").trim();
        var oAmount = Math.round(Number(data.amount || 0));
        var oStatus = String(data.status || "Chờ thanh toán").trim();
        var oDate = String(data.order_date || "").trim() || nowVN_();
        var oNote = String(data.note || "").trim();

        if (data.original_order_code) {
          var oRow = findRowByCol_(oSheet, 2, data.original_order_code);
          if (oRow === -1) return jsonResponse_({ status: "error", error: "Không tìm thấy đơn hàng." });
          oSheet.getRange(oRow, 1, 1, 8).setValues([[oDate, oCode, oCustName, oPhone ? "'" + oPhone : "", oAddress, oItems, oAmount, oStatus]]);
          oSheet.getRange(oRow, 12).setValue(oNote);
          return jsonResponse_({ status: "success" });
        }

        // Tao don moi: chi tru ton kho neu chon san pham vat ly (physical)
        var stockDeducted = false;
        if (data.product_id) {
          var pSheetOrd = getProductSheet_(ss);
          var pRowOrd = findRowByCol_(pSheetOrd, 1, data.product_id);
          if (pRowOrd !== -1) {
            var pVals = pSheetOrd.getRange(pRowOrd, 1, 1, 6).getValues()[0];
            var prodType = String(pVals[2] || "physical");
            var qty = Math.max(1, Math.round(Number(data.quantity || 1)));
            if (prodType === "physical") {
              var curStock = Number(pVals[5] || 0);
              if (curStock < qty) {
                return jsonResponse_({ status: "error", error: "Không đủ tồn kho (còn " + curStock + ", cần " + qty + ")." });
              }
              pSheetOrd.getRange(pRowOrd, 6).setValue(curStock - qty);
              stockDeducted = true;
            }
          }
        }

        oSheet.appendRow([
          oDate, oCode, oCustName, oPhone ? "'" + oPhone : "",
          oAddress, oItems, oAmount, oStatus,
          oStatus === "Đã thanh toán" ? oAmount : 0,
          oStatus === "Đã thanh toán" ? nowVN_() : "",
          "", oNote
        ]);
        return jsonResponse_({ status: "success", stock_deducted: stockDeducted });
      }

      if (action === "admin_delete_order") {
        var oSheetDel = getOrderSheet_(ss);
        var oRowDel = findRowByCol_(oSheetDel, 2, data.order_code);
        if (oRowDel === -1) return jsonResponse_({ status: "error", error: "Không tìm thấy đơn hàng." });
        oSheetDel.deleteRow(oRowDel);
        return jsonResponse_({ status: "success" });
      }
    }

    // ---- WEBSITE TAO DON HANG ----
    if (action === "create_order") {
      var orderSheet = getOrderSheet_(ss);
      var orderCode = String(data.order_code || ("ML" + Date.now().toString().slice(-6))).toUpperCase();
      var amount = Number(data.amount || 0);

      orderSheet.appendRow([
        nowVN_(), orderCode, data.customer_name || "",
        "'" + String(data.phone || ""), data.address || "",
        data.items || "", amount, "Chờ thanh toán", 0, "", "", data.note || ""
      ]);

      return jsonResponse_({ status: "success", order_code: orderCode });
    }

    // ---- SEPAY WEBHOOK ----
    if (data.transferType !== undefined || data.transferAmount !== undefined) {
      if (data.transferType && data.transferType !== "in") {
        return jsonResponse_({ success: true, message: "Ignored outgoing" });
      }

      var txnSheet = getTxnSheet_(ss);
      var sepayId = String(data.id || "");
      var transferAmount = Number(data.transferAmount || 0);
      var content = String(data.content || "");
      var contentUpper = content.toUpperCase();
      var sepayCodeUpper = String(data.code || "").toUpperCase();

      if (sepayId && txnSheet.getLastRow() > 1) {
        var existingIds = txnSheet.getRange(2, 2, txnSheet.getLastRow() - 1, 1).getValues();
        for (var i = 0; i < existingIds.length; i++) {
          if (String(existingIds[i][0]) === sepayId) {
            return jsonResponse_({ success: true, message: "Duplicate ignored" });
          }
        }
      }

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

      txnSheet.appendRow([
        nowVN_(), sepayId, data.gateway || "", data.transactionDate || "",
        "'" + String(data.subAccount || data.accountNumber || ""),
        transferAmount, content, data.referenceCode || "", matchedOrderCode
      ]);

      return jsonResponse_({ success: true, matched_order: matchedOrderCode });
    }

    return jsonResponse_({ status: "error", message: "Unknown payload" });
  } catch (error) {
    return jsonResponse_({ status: "error", error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (params.action === "admin_list") {
      if (!checkPin_(params.pin)) {
        return jsonResponse_({ status: "error", error: "Sai mã PIN quản trị." });
      }
      return jsonResponse_({
        status: "success",
        products: readAllProducts_(ss),
        customers: readAllCustomers_(ss),
        orders: readAllOrders_(ss)
      });
    }

    if (params.action === "check_order" && params.order_code) {
      var targetCode = String(params.order_code).trim().toUpperCase();
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

      return jsonResponse_({ status: "not_found", order_code: targetCode, payment_status: "Không tìm thấy" });
    }

    return jsonResponse_({ status: "ok", message: "Men Lanh SePay & Admin Webhook is running!" });
  } catch (error) {
    return jsonResponse_({ status: "error", error: error.toString() });
  }
}
