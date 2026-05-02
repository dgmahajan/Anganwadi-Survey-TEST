// ============================================================
//  COMPLETE APPS SCRIPT — paste entire contents into Code.gs
//  Last updated: 2026-04-30
// ============================================================

function doPost(e) {
  var data    = JSON.parse(e.postData.contents);
  var tabName = data.sheet_tab;
  if (String(data.udise).indexOf('TEST') === 0) tabName = tabName + '-TEST';
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheet   = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow(['Timestamp','UDISE','Anganwadi Name','Taluka','Mobile',
      'q0','q1','q2','q3','q4','q5','q6','q7','q8','q9']);
  }

  try { data = savePhotosToDrive(data); } catch(err) { /* photo failed, still write row */ }

  var row = [
    data.timestamp, data.udise, data.anganwadi_name, data.taluka, data.mobile||'',
    data.q0||'', data.q1||'', data.q2||'', data.q3||'', data.q4||'',
    data.q5||'', data.q6||'', data.q7||'', data.q8||'', data.q9||''
  ];

  var values = sheet.getDataRange().getValues();
  var existingRow = -1;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]) === String(data.udise)) { existingRow = i + 1; break; }
  }
  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return ContentService
    .createTextOutput(JSON.stringify({status:'ok'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (e.parameter.action === 'all_submitted') {
    var tabName = e.parameter.tab || '';
    var sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tabName);
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({submitted_udises:[]}))
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
          if (u && u.indexOf('TEST') !== 0) udises.push(u);
        }
      }
    }
    return ContentService
      .createTextOutput(JSON.stringify({submitted_udises:udises}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var udise   = e.parameter.udise;
  var tabName = e.parameter.tab;
  if (String(udise).indexOf('TEST') === 0) tabName = tabName + '-TEST';
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheet   = ss.getSheetByName(tabName);
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify({submitted:false}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(udise)) {
      return ContentService
        .createTextOutput(JSON.stringify({
          submitted: true,
          prior: {
            mobile: data[i][4]  !== '' ? String(data[i][4])  : '',
            q0:     data[i][5]  !== '' ? String(data[i][5])  : '',
            q1:     data[i][6]  !== '' ? String(data[i][6])  : '',
            q2:     data[i][7]  !== '' ? String(data[i][7])  : '',
            q3:     data[i][8]  !== '' ? String(data[i][8])  : '',
            q4:     data[i][9]  !== '' ? String(data[i][9])  : '',
            q5:     data[i][10] !== '' ? String(data[i][10]) : '',
            q6:     data[i][11] !== '' ? String(data[i][11]) : '',
            q7:     data[i][12] !== '' ? String(data[i][12]) : '',
            q8:     data[i][13] !== '' ? String(data[i][13]) : '',
            q9:     data[i][14] !== '' ? String(data[i][14]) : ''
          }
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({submitted:false}))
    .setMimeType(ContentService.MimeType.JSON);
}

function savePhotosToDrive(payload) {
  var folder = null;
  Object.keys(payload).forEach(function(key) {
    var val = payload[key];
    if (typeof val !== 'string' || val.indexOf('data:image') !== 0) return;
    try {
      if (!folder) folder = getSurveyImagesFolder();
      var parts   = val.split(',');
      var mime    = (parts[0].match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
      var ext     = mime.split('/')[1] || 'jpg';
      var decoded = Utilities.base64Decode(parts[1]);
      var blob    = Utilities.newBlob(decoded, mime,
                      [payload.udise, key, Date.now()].join('_') + '.' + ext);
      var file    = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      payload[key] = file.getUrl();
    } catch(err) {
      payload[key] = 'PHOTO_SAVE_ERROR: ' + err.message;
    }
  });
  return payload;
}

function getSurveyImagesFolder() {
  var name    = 'Survey-Images';
  var folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}
