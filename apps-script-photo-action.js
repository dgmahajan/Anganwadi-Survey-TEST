// ============================================================
//  ADD THIS CODE TO YOUR GOOGLE APPS SCRIPT
//
//  STEP 1 — Add the two helper functions below OUTSIDE of
//           doPost / doGet (anywhere in the script file).
//
//  STEP 2 — Inside your existing doPost(e) function, find
//           the line where you write the row to the sheet
//           (something like sheet.appendRow([...]) or
//           sheet.getRange(...).setValues([...])).
//           BEFORE that line, add this one call:
//
//               payload = savePhotosToD rive(payload);
//
//           That's it. It automatically detects any base64
//           images in the submitted answers, saves them to
//           Drive, and replaces the base64 with a URL —
//           so the Sheet cell contains a clickable link.
// ============================================================


// ── Helper 1: Save any base64 images to Google Drive ─────────
function savePhotosToDrive(payload) {
  var folder = getSurveyImagesFolder();

  Object.keys(payload).forEach(function(key) {
    var val = payload[key];
    if (typeof val !== 'string' || val.indexOf('data:image') !== 0) return;

    try {
      // Split "data:image/jpeg;base64,<data>"
      var parts    = val.split(',');
      var mime     = (parts[0].match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
      var ext      = mime.split('/')[1] || 'jpg';
      var decoded  = Utilities.base64Decode(parts[1]);
      var blob     = Utilities.newBlob(decoded, mime,
                       [payload.udise, key, Date.now()].join('_') + '.' + ext);

      var file = folder.createFile(blob);
      // Make the file viewable by anyone with the link
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      // Replace the base64 blob with a plain Drive URL
      payload[key] = file.getUrl();
    } catch (err) {
      // If saving fails, store an error note rather than crashing the whole submission
      payload[key] = 'PHOTO_SAVE_ERROR: ' + err.message;
    }
  });

  return payload;
}


// ── Helper 2: Get (or create) the "Survey-Images" Drive folder ─
function getSurveyImagesFolder() {
  var name    = 'Survey-Images';
  var folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}


// ============================================================
//  AFTER ADDING THE CODE, RE-DEPLOY:
//  Extensions → Apps Script → Deploy → Manage deployments
//  → click the pencil icon on your current deployment
//  → bump the version → Deploy
// ============================================================
