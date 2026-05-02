// ============================================================
//  ADD THIS BLOCK INSIDE YOUR EXISTING doGet(e) FUNCTION
//  in Google Apps Script.
//
//  Find the line that reads:
//      function doGet(e) {
//  and paste this block near the TOP of that function,
//  BEFORE the existing udise-check code.
// ============================================================

  // ── NEW: Return all submitted UDISE codes for a sheet tab ──
  if (e.parameter.action === 'all_submitted') {
    var tabName = e.parameter.tab || '';
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName);

    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ submitted_udises: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data    = sheet.getDataRange().getValues();
    var udises  = [];

    if (data.length > 1) {
      var headers  = data[0].map(function(h) { return String(h).trim().toLowerCase(); });
      var udiseCol = headers.indexOf('udise');

      if (udiseCol >= 0) {
        for (var i = 1; i < data.length; i++) {
          var u = String(data[i][udiseCol]).trim();
          if (u && u !== 'TEST') {
            udises.push(u);
          }
        }
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ submitted_udises: udises }))
      .setMimeType(ContentService.MimeType.JSON);
  }

// ============================================================
//  ALSO: make sure your doGet function sets CORS headers
//  so the admin page can read the response.
//  Your existing code likely already does this — look for
//  a line like:
//      .setHeader('Access-Control-Allow-Origin', '*')
//  If it is missing, wrap the return above like this:
//
//  return ContentService
//    .createTextOutput(JSON.stringify({ submitted_udises: udises }))
//    .setMimeType(ContentService.MimeType.JSON);
//    // Note: Google Apps Script Web Apps set CORS automatically
//    // when deployed as "Execute as Me, Anyone can access"
// ============================================================
