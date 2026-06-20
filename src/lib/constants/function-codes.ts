// Function codes for hotel operations
// These are constants and should be in a separate non-server file

export const FUNCTION_CODES = {
  PAYMENT: "KO39",      // ชำระเงิน
  VOID: "KO40",         // ยกเลิก
  POST_CHARGE: "KO41",  // บันทึกค่าใช้จ่าย
  TRANSFER: "KO42",     // โอนระหว่าง Folio
  FOLIO_SETUP: "KO43",  // ตั้งค่า Folio
  CHECKOUT: "KO44",     // ออกจากห้อง
  CREDIT_NOTE: "KO45",  // ออก Credit Note
  CORRECTION: "KO46",   // ปรับปรุงรายการ
  SPLIT: "KO47",        // แยกรายการ
  TAX_INVOICE: "KO48",  // ออกใบกำกับภาษี
  FAST_POSTING: "KO50", // Fast Posting
  DUMMY_ROOM: "KO51",  // Dummy Room Folio
  ADVANCE_PAY: "KO52",  // รับเงินล่วงหน้า
  FORECAST: "KC27",     // Forecast
} as const;

export type FunctionCodeKey = keyof typeof FUNCTION_CODES;
