// ── Survey Application Logic ──────────────────────────────────

window.SURVEYS = window.SURVEYS || [];
let currentSurvey = null;
let answers = {};

// ── Load survey files dynamically ────────────────────────────
async function loadSurveyFiles() {
  for (const id of SURVEY_INDEX) {
    await new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = `surveys/${id}.js?v=${Date.now()}`;
      s.onload = resolve;
      s.onerror = () => { console.warn('Could not load: ' + id); resolve(); };
      document.head.appendChild(s);
    });
  }
}

// ── Date helpers ──────────────────────────────────────────────
function today() {
  return new Date().toISOString().split('T')[0];
}

function isActive(survey) {
  const t = today();
  return t >= survey.start && t <= survey.end;
}

// ── Main init ─────────────────────────────────────────────────
async function initApp() {
  await loadSurveyFiles();
  const active = (window.SURVEYS || []).filter(isActive);
  if (active.length === 0) {
    showNoSurveys();
  } else if (active.length === 1) {
    showSurvey(active[0]);
  } else {
    showSurveyList(active);
  }
}

// ── Screen: No active surveys ─────────────────────────────────
function showNoSurveys() {
  document.getElementById('app').innerHTML = `
    <div class="card">
      <div class="header"><h1>अंगणवाडी सर्वेक्षण</h1><p>Angawadi Survey Portal</p></div>
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h2>सध्या कोणतेही सर्वेक्षण उपलब्ध नाही</h2>
        <p>No active surveys at this time.<br/>Please check back later.</p>
      </div>
    </div>`;
}

// ── Screen: Survey list ───────────────────────────────────────
function showSurveyList(surveys) {
  window.SURVEYS_MAP = {};
  surveys.forEach(s => window.SURVEYS_MAP[s.id] = s);
  const items = surveys.map(s => `
    <div class="survey-card" onclick="showSurvey(SURVEYS_MAP['${s.id}'])">
      <div class="survey-card-name">${s.name}</div>
      <div class="survey-card-sub">${s.subtitle || ''}</div>
      <div class="survey-card-dates">📅 ${s.start} ते ${s.end}</div>
    </div>`).join('');
  document.getElementById('app').innerHTML = `
    <div class="card">
      <div class="header"><h1>अंगणवाडी सर्वेक्षण</h1><p>Angawadi Survey Portal</p></div>
      <p class="section-title">सक्रिय सर्वेक्षण निवडा</p>
      <p class="section-sub">Select a survey to answer</p>
      ${items}
    </div>`;
}

// ── Screen: Survey form ───────────────────────────────────────
function showSurvey(survey) {
  currentSurvey = survey;
  answers = {};
  const sorted = [...survey.schools].sort((a, b) => a.name.localeCompare(b.name, 'mr'));
  const udiseOpts = sorted.map(s => `<option value="${s.udise}">${s.udise}</option>`).join('');
  const nameOpts  = sorted.map(s => `<option value="${s.udise}">${s.name}</option>`).join('');

  document.getElementById('app').innerHTML = `
    <div class="card">
      <div class="header"><h1>${survey.name}</h1><p>${survey.subtitle || ''}</p></div>
      <form id="survey-form">
        <label>अंगणवाडी क्रमांक निवडा *</label>
        <select id="sel-udise"><option value="">-- अंगणवाडी क्रमांक निवडा --</option>${udiseOpts}</select>
        <label style="margin-top:14px;">अंगणवाडीचे नाव निवडा *</label>
        <select id="sel-name"><option value="">-- अंगणवाडीचे नाव निवडा --</option>${nameOpts}</select>
        <div id="match-ok"    class="match-ok"    style="display:none;">✓ अंगणवाडी क्रमांक आणि अंगणवाडीचे नाव जुळते.</div>
        <div id="match-fail"  class="match-fail"  style="display:none;">✗ अंगणवाडी क्रमांक आणि अंगणवाडीचे नाव जुळत नाही. कृपया पुन्हा निवडा.</div>
        <div id="prior-notice" class="prior-notice" style="display:none;">
          ✏️ तुमच्या अंगणवाडीने आधीच उत्तर दिले आहे. तुम्ही खाली बदल करून पुन्हा सादर करू शकता.<br/>
          <small>Your Anganwadi already submitted. You can edit and resubmit below.</small>
        </div>
        <div id="questions-section" style="display:none;">
          <label style="margin-top:20px;">मोबाइल नंबर *</label>
          <div class="subtext">Mobile number (10 digits)</div>
          <input type="tel" id="mobile-number" placeholder="10-अंकी मोबाइल नंबर" maxlength="10" />
          <div id="questions-container"></div>
          <button type="submit" class="submit-btn" id="submit-btn">सादर करा (Submit)</button>
        </div>
      </form>
    </div>`;

  document.getElementById('sel-udise').addEventListener('change', checkMatch);
  document.getElementById('sel-name').addEventListener('change', checkMatch);
  document.getElementById('survey-form').addEventListener('submit', submitSurvey);
  buildQuestions(survey);
}

// ── Check UDISE + name match ──────────────────────────────────
async function checkMatch() {
  const u = document.getElementById('sel-udise').value;
  const n = document.getElementById('sel-name').value;
  document.getElementById('match-ok').style.display     = 'none';
  document.getElementById('match-fail').style.display   = 'none';
  document.getElementById('prior-notice').style.display = 'none';
  document.getElementById('questions-section').style.display = 'none';
  if (!u || !n) return;
  if (u !== n) { document.getElementById('match-fail').style.display = 'block'; return; }

  // Fetch prior data silently, then reveal everything at once
  let hasPrior = false;
  try {
    const res  = await fetch(SUBMIT_URL + '?udise=' + u + '&tab=' + encodeURIComponent(currentSurvey.sheet_tab));
    const data = await res.json();
    if (data.submitted && data.prior) {
      hasPrior = true;
      if (data.prior.mobile) document.getElementById('mobile-number').value = data.prior.mobile;
      prefillAnswers(data.prior);
    }
  } catch (err) { /* allow on network error */ }

  // Reveal form only now — fully populated, all at once
  document.getElementById('match-ok').style.display    = 'block';
  if (hasPrior) document.getElementById('prior-notice').style.display = 'block';
  document.getElementById('questions-section').style.display = 'block';
}

// ── Build questions ───────────────────────────────────────────
function buildQuestions(survey) {
  answers = {};
  const container = document.getElementById('questions-container');
  container.innerHTML = '';
  survey.questions.forEach(q => {
    const block = document.createElement('div');
    block.className = 'question-block' + (q.showIf ? ' hidden' : '');
    block.id = 'block-' + q.id;
    const lbl = document.createElement('label');
    lbl.textContent = q.text;
    block.appendChild(lbl);
    if (q.subtext) {
      const sub = document.createElement('div');
      sub.className = 'subtext';
      sub.textContent = q.subtext;
      block.appendChild(sub);
    }
    if (q.image) {
      const imgSrc = `surveys/${survey.id}/${q.image}`;
      const wrap = document.createElement('div');
      wrap.className = 'q-image-wrap';
      wrap.innerHTML = `
        <img class="q-thumb" src="${imgSrc}" alt="प्रश्नाशी संबंधित चित्र"
             onclick="openLightbox('${imgSrc}')" />
        <div class="q-thumb-hint">👆 चित्र मोठे पाहण्यासाठी स्पर्श करा / Tap to enlarge</div>`;
      block.appendChild(wrap);
    }
    if (q.type === 'yesno' || q.type === 'yesnodk') {
      const row = document.createElement('div');
      row.className = 'yesno-row';
      row.id = 'row-' + q.id;
      const opts = q.type === 'yesnodk'
        ? [{val:'yes',label:'होय (Yes)',cls:'yes'},{val:'no',label:'नाही (No)',cls:'no'},{val:'dk',label:"माहीत नाही (Don't Know)",cls:'dk'}]
        : [{val:'yes',label:'होय (Yes)',cls:'yes'},{val:'no',label:'नाही (No)',cls:'no'}];
      opts.forEach(({val, label, cls}) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'yesno-btn ' + cls;
        btn.textContent = label;
        btn.dataset.val = val;
        btn.addEventListener('click', () => {
          row.querySelectorAll('.yesno-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          answers[q.id] = val;
          updateConditionals();
        });
        row.appendChild(btn);
      });
      block.appendChild(row);
    } else if (q.type === 'number') {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.id = 'inp-' + q.id;
      inp.min = q.min != null ? q.min : 1; inp.max = q.max != null ? q.max : 99;
      inp.placeholder = `${q.min || 1} ते ${q.max || 99}`;
      inp.addEventListener('input', () => { answers[q.id] = inp.value; });
      block.appendChild(inp);
    } else if (q.type === 'text') {
      const ta = document.createElement('textarea');
      ta.id = 'inp-' + q.id;
      ta.placeholder = 'येथे लिहा...';
      ta.addEventListener('input', () => { answers[q.id] = ta.value; });
      block.appendChild(ta);
    } else if (q.type === 'photo') {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.id = 'inp-' + q.id;
      fileInput.style.cssText = 'visibility:hidden;position:absolute;width:0;height:0;';

      const uploadLabel = document.createElement('label');
      uploadLabel.className = 'photo-upload-btn';
      uploadLabel.innerHTML = `<span class="icon">📷</span><span>फोटो काढा / Take photo using any GPS camera app</span>`;
      uploadLabel.appendChild(fileInput);

      const note = document.createElement('div');
      note.className = 'photo-optional-note';
      note.textContent = '(ऐच्छिक — Optional)';

      const previewWrap = document.createElement('div');
      previewWrap.className = 'photo-preview-wrap';
      previewWrap.style.display = 'none';

      const previewImg = document.createElement('img');
      previewImg.className = 'photo-preview';
      previewImg.addEventListener('click', () => openLightbox(previewImg.src));

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'photo-remove';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => {
        delete answers[q.id];
        fileInput.value = '';
        previewImg.src = '';
        previewWrap.style.display = 'none';
        uploadLabel.style.display = 'flex';
      });

      previewWrap.appendChild(previewImg);
      previewWrap.appendChild(removeBtn);

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        uploadLabel.innerHTML = `<span class="icon">⏳</span><span>Compressing…</span>`;
        const compressed = await compressImage(file);
        answers[q.id] = compressed;
        previewImg.src = compressed;
        previewWrap.style.display = 'inline-block';
        uploadLabel.style.display = 'none';
        uploadLabel.innerHTML = `<span class="icon">📷</span><span>फोटो काढा / Take photo using any GPS camera app</span>`;
      });

      block.appendChild(uploadLabel);
      block.appendChild(previewWrap);
      block.appendChild(note);
    }
    container.appendChild(block);
  });
}

// ── Pre-fill from prior submission ────────────────────────────
function prefillAnswers(prior) {
  if (!currentSurvey) return;
  currentSurvey.questions.forEach(q => {
    const raw = prior[q.id];
    if (raw === undefined || raw === null || raw === '') return;
    const val = String(raw).trim();
    answers[q.id] = val;
    if (q.type === 'yesno' || q.type === 'yesnodk') {
      const row = document.getElementById('row-' + q.id);
      if (row) row.querySelectorAll('.yesno-btn').forEach(btn => {
        if (btn.dataset.val === val) btn.classList.add('active');
      });
    } else if (q.type === 'photo') {
      const block = document.getElementById('block-' + q.id);
      if (block && val.startsWith('http')) {
        const div = document.createElement('div');
        div.className = 'prior-photo-notice';
        div.innerHTML = `📷 <strong>आधीचा फोटो सादर आहे.</strong><br/>
          <a href="${val}" target="_blank">पाहण्यासाठी येथे क्लिक करा / Click to view submitted photo</a><br/>
          <small>नवीन फोटो अपलोड केल्यास तो बदलेल / Upload a new photo to replace it</small>`;
        const uploadLabel = block.querySelector('.photo-upload-btn');
        if (uploadLabel) block.insertBefore(div, uploadLabel);
        else block.appendChild(div);
      }
    } else {
      const inp = document.getElementById('inp-' + q.id);
      if (inp) inp.value = val;
    }
  });
  updateConditionals();
}

// ── Show/hide conditional questions ──────────────────────────
function updateConditionals() {
  if (!currentSurvey) return;
  currentSurvey.questions.forEach(q => {
    if (!q.showIf) return;
    const block = document.getElementById('block-' + q.id);
    if (!block) return;
    if (answers[q.showIf.id] === q.showIf.value) {
      block.classList.remove('hidden');
    } else {
      block.classList.add('hidden');
      delete answers[q.id];
    }
  });
}

// ── Submit ────────────────────────────────────────────────────
async function submitSurvey(e) {
  e.preventDefault();
  const udise  = document.getElementById('sel-udise').value;
  const mobile = document.getElementById('mobile-number').value.trim();
  if (!udise || document.getElementById('sel-name').value !== udise) {
    document.getElementById('match-fail').style.display = 'block'; return;
  }
  if (!/^[0-9]{10}$/.test(mobile)) {
    alert('कृपया 10-अंकी मोबाइल नंबर टाका.\nPlease enter a valid 10-digit mobile number.'); return;
  }
  for (const q of currentSurvey.questions) {
    const block = document.getElementById('block-' + q.id);
    if (!block || block.classList.contains('hidden') || q.optional || q.type === 'photo') continue;
    if (!answers[q.id] && answers[q.id] !== 0) {
      alert('कृपया सर्व प्रश्नांची उत्तरे द्या.\nPlease answer all required questions.'); return;
    }
  }
  const school = currentSurvey.schools.find(s => s.udise === udise);
  const payload = {
    udise: school.udise, anganwadi_name: school.name, taluka: school.taluka,
    mobile, timestamp: new Date().toISOString(), sheet_tab: currentSurvey.sheet_tab, ...answers,
  };
  const btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = 'सादर होत आहे...';
  try {
    await fetch(SUBMIT_URL, { method:'POST', mode:'no-cors', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });

    // Verify the record actually landed in the sheet
    btn.textContent = 'तपासत आहे... / Verifying...';
    let verified = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const check = await fetch(SUBMIT_URL + '?udise=' + encodeURIComponent(udise) + '&tab=' + encodeURIComponent(currentSurvey.sheet_tab));
        const result = await check.json();
        if (result.submitted) { verified = true; break; }
      } catch(_) { /* retry */ }
    }

    if (!verified) throw new Error('नोंद सापडली नाही / Record not confirmed in sheet after submission.');

    document.getElementById('app').innerHTML = `
      <div class="card">
        <div class="success-screen">
          <div class="success-icon">✅</div>
          <h2>धन्यवाद!</h2>
          <p>तुमचा प्रतिसाद यशस्वीरित्या नोंदवला गेला.<br/>Thank you — your response has been recorded.</p>
          <p class="success-school">${school.name}<br/><small>UDISE: ${school.udise}</small></p>
        </div>
      </div>`;
  } catch (err) {
    alert('सादर करताना त्रुटी आली — तुमचा डेटा सेव्ह झाला नाही. इंटरनेट तपासा आणि पुन्हा प्रयत्न करा.\nSubmission failed — your data was NOT saved. Check your internet and try again.');
    btn.disabled = false; btn.textContent = 'सादर करा (Submit)';
  }
}

// ── Image compression ─────────────────────────────────────────
function compressImage(file, maxWidth = 1024, quality = 0.72) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Lightbox ──────────────────────────────────────────────────
function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('open');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lightbox-img').src = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeLightbox();
});

// ── Start ─────────────────────────────────────────────────────
initApp();
