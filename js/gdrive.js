/* gdrive.js — Google Sign-In (herkes) + Drive izni (isteğe bağlı, incremental)
   NOT ALMA:
   - Klasör adı: Kuran_Teyit_Not
   - Dosya adı formatı: <sura>_<ayet>.txt  (örn: 2_255.txt)
   - Kullanıcı Google Dokümanı da oluşturabilir (2_255 veya 2_255.txt adıyla); export edilerek okunur.
*/

/* ========= Yapılandırma ========= */
const GDRIVE_CONFIG = {
  CLIENT_ID: '',
  API_KEY: '',
  FOLDER_NAME: 'Kuran_Teyit_Not',
  SCOPES: 'https://www.googleapis.com/auth/drive.file'
};

/* ========= Durum ========= */
let gapiInited = false;     // Google API client (Drive) hazır mı?
let gisInited  = false;     // Google Identity Services yüklendi mi?
let tokenClient = null;     // Drive izinleri için token client
let isSignedIn = false;     // Google hesabıyla giriş yapıldı mı?
let hasDriveGrant = false;  // Drive izni alındı mı?
let accessToken = null;     // Drive erişim token’ı
let folderId = null;        // Not klasörü ID

/* ========= Loader Callbacks ========= */
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  try {
    await gapi.client.init({
      apiKey: GDRIVE_CONFIG.API_KEY,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
    });
    gapiInited = true;
    console.log('GAPI client hazır.');
  } catch (err) {
    console.error('GAPI init hatası:', err);
    showNotification('Google API başlatılamadı!', 'error');
  }
}

function gisLoaded() {
  // 1) Herkes için Google ile giriş (yalnızca kimlik)
  google.accounts.id.initialize({
    client_id: GDRIVE_CONFIG.CLIENT_ID,
    callback: onSignIn,
    auto_select: false
  });

  const signInDiv = document.getElementById('g_id_signin');
  if (signInDiv) {
    google.accounts.id.renderButton(signInDiv, {
      type: 'standard',
      size: 'medium',
      theme: 'outline',
      text: 'signin_with',
      shape: 'rectangular',
      logo_alignment: 'left'
    });

    // 10 saniye sonra giriş butonunu otomatik gizle
    setTimeout(() => {
      if (!isSignedIn) {
        signInDiv.style.display = 'none';
      }
    }, 10000);
  }

  // 2) Drive’a izin gerektiğinde iste (incremental)
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GDRIVE_CONFIG.CLIENT_ID,
    scope: GDRIVE_CONFIG.SCOPES,
    prompt: '', // mümkünse tekrar tekrar consent göstermesin
    callback: (resp) => {
      if (resp && resp.access_token) {
        accessToken = resp.access_token;
        hasDriveGrant = true;
        updateAuthUI();
        initializeDrive(); // klasörü hazırla + notları yükle
        showNotification('Google Drive bağlandı!', 'success');
      } else if (resp && resp.error) {
        console.error('Drive token hatası:', resp);
        showNotification('Drive izni alınamadı.', 'error');
      }
    }
  });

  gisInited = true;
  updateAuthUI();
  console.log('GIS yüklendi.');
}

/* ========= Kimlik (Sign-In) ========= */
function onSignIn(credentialResponse) {
  // ID token doğrulamasını istersen sunucunda yapabilirsin: credentialResponse.credential
  isSignedIn = true;
  updateAuthUI();
  showNotification('Google ile giriş başarılı.', 'success');
}

function connectDrive() {
  if (!isSignedIn) {
    showNotification('Önce Google ile giriş yapın.', 'warning');
    return;
  }
  if (!tokenClient) {
    showNotification('Kimlik servisi hazır değil. Sayfayı yenileyin.', 'error');
    return;
  }
  tokenClient.requestAccessToken({
    prompt: 'consent',
    include_granted_scopes: true
  });
}

/* ========= UI Güncelleme ========= */
function updateAuthUI() {
  const signInBtn  = document.getElementById('g_id_signin');
  const connectBtn = document.getElementById('connectDriveBtn');
  const logoutBtn  = document.getElementById('logoutBtn');

  // Giriş butonu
  if (signInBtn) signInBtn.style.display = isSignedIn ? 'none' : 'block';

  // Drive’a Bağla butonu
  if (connectBtn) {
    if (isSignedIn && !hasDriveGrant) {
      connectBtn.classList.remove('hidden');
      connectBtn.style.display = 'inline-block';
    } else {
      connectBtn.style.display = 'none';
      connectBtn.classList.add('hidden');
    }
  }

  // Çıkış butonu
  if (logoutBtn) {
    if (isSignedIn) {
      logoutBtn.classList.remove('hidden');
      logoutBtn.style.display = 'inline-block';
    } else {
      logoutBtn.style.display = 'none';
      logoutBtn.classList.add('hidden');
    }
  }

  // Ayarlar sayfasındaki canlı durum etiketleri
  const driveStatus  = document.getElementById('driveStatus');
  const folderStatus = document.getElementById('folderStatus');
  if (driveStatus)  driveStatus.textContent  = isDriveReady() ? '🟢 Bağlı' : '🔴 Bağlı değil';
  if (folderStatus) folderStatus.textContent = folderId ? '✅ Hazır' : '❌ Bulunamadı';
}

/* ========= Drive Başlatma & Klasör ========= */
async function initializeDrive() {
  if (!gapiInited || !hasDriveGrant) {
    console.warn('Drive başlatılamıyor — GAPI ya da Drive izni eksik');
    return;
  }
  try {
    await ensureFolder();
    await loadAllNotesFromDrive();
    console.log('Drive hazır.');
  } catch (err) {
    console.error('Drive init hatası:', err);
    showNotification('Google Drive bağlantı hatası!', 'error');
  }
}

async function ensureFolder() {
  if (!gapiInited || !hasDriveGrant) return;

  try {
    const search = await gapi.client.drive.files.list({
      q: `name='${GDRIVE_CONFIG.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive'
    });

    if (search.result.files?.length) {
      folderId = search.result.files[0].id;
    } else {
      const create = await gapi.client.drive.files.create({
        resource: { name: GDRIVE_CONFIG.FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id'
      });
      folderId = create.result.id;
    }
  } catch (err) {
    console.error('Klasör kontrol/oluşturma hatası:', err);
    showNotification('Klasör oluşturma hatası!', 'error');
  }
}

/* ========= İçerik okuma yardımcı ========= */
async function getFileTextById(fileId, mimeType) {
  try {
    if (mimeType === 'application/vnd.google-apps.document') {
      // Google Dokümanı -> düz metin olarak export et
      const res = await gapi.client.drive.files.export({
        fileId,
        mimeType: 'text/plain'
      });
      return res.body || '';
    } else {
      // Düz dosya (text/plain vs.) -> alt=media ile indir
      const res = await gapi.client.drive.files.get({
        fileId,
        alt: 'media'
      });
      return res.body || '';
    }
  } catch (err) {
    console.error('Dosya içeriği alınamadı:', err);
    return '';
  }
}

/* ========= Not Kaydet / Oku ========= */
async function saveNoteToDrive(sura, verse, noteContent) {
  if (!isSignedIn)      { showNotification('Google ile giriş yapın!', 'warning'); return false; }
  if (!hasDriveGrant)   { showNotification('Drive’a bağlanın.', 'warning');        return false; }
  if (!folderId)        { await ensureFolder(); if (!folderId) { showNotification('Klasör oluşturulamadı.', 'error'); return false; } }
  if (!noteContent?.trim()) { showNotification('Not içeriği boş olamaz!', 'warning'); return false; }

  const fileName = `${sura}_${verse}.txt`;
  try {
    // Aynı adla dosya var mı?
    const search = await gapi.client.drive.files.list({
      q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
      fields: 'files(id,name)',
      spaces: 'drive'
    });
    const fileId = search.result.files?.[0]?.id || null;

    // multipart body
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;
    let method, path, body;

    if (fileId) {
      body =
        delimiter + 'Content-Type: application/json\r\n\r\n' + '{}' +
        delimiter + 'Content-Type: text/plain\r\n\r\n' + noteContent + closeDelim;
      method = 'PATCH';
      path = `/upload/drive/v3/files/${fileId}`;
    } else {
      const metadata = { name: fileName, parents: [folderId], mimeType: 'text/plain' };
      body =
        delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) +
        delimiter + 'Content-Type: text/plain\r\n\r\n' + noteContent + closeDelim;
      method = 'POST';
      path = '/upload/drive/v3/files';
    }

    await gapi.client.request({
      path,
      method,
      params: { uploadType: 'multipart' },
      headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
      body
    });

    showNotification(fileId ? 'Not güncellendi!' : 'Not kaydedildi!', 'success');
    return true;
  } catch (err) {
    console.error('Not kaydetme hatası:', err);
    showNotification('Not kaydedilirken hata oluştu!', 'error');
    return false;
  }
}

async function loadNoteFromDrive(sura, verse) {
  if (!isSignedIn || !hasDriveGrant || !folderId) return '';

  const baseName = `${sura}_${verse}`;
  const exactTxtName = `${baseName}.txt`;
  try {
    // 1) Klasörde aynı isimli dosyaları (hem .txt hem Google Doc) ara
    const list = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed=false and (name='${exactTxtName}' or name='${baseName}')`,
      fields: 'files(id,name,mimeType,modifiedTime)',
      spaces: 'drive'
    });

    let candidates = list.result.files || [];

    // 2) Öncelik: text/plain uzantılı olanlar, sonra Google Doküman
    const preferredOrder = (f) => {
      if (f.mimeType === 'text/plain') return 0;
      if (f.mimeType === 'application/vnd.google-apps.document') return 1;
      return 2;
    };
    candidates.sort((a, b) => preferredOrder(a) - preferredOrder(b));

    // 3) Eğer hiç çıkmadıysa, regex’e uyan tüm dosyalar (örn. "2_255", "2_255.txt")
    if (candidates.length === 0) {
      const broad = await gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id,name,mimeType,modifiedTime)',
        spaces: 'drive',
        pageSize: 1000
      });
      const re = new RegExp(`^${sura}_${verse}(?:\\.txt)?$`, 'i');
      candidates = (broad.result.files || []).filter(f => re.test(f.name));
      candidates.sort((a, b) => preferredOrder(a) - preferredOrder(b));
    }

    if (candidates.length === 0) return '';

    const file = candidates[0];
    return await getFileTextById(file.id, file.mimeType);
  } catch (err) {
    console.error('Not yükleme hatası:', err);
    return '';
  }
}

async function loadAllNotesFromDrive() {
  if (!isSignedIn || !hasDriveGrant || !folderId) return;
  try {
    let pageToken = null;
    const re = /^(\d+)_(\d+)(?:\.txt)?$/i;

    do {
      const list = await gapi.client.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id,name,mimeType,modifiedTime)',
        spaces: 'drive',
        pageSize: 1000,
        pageToken
      });

      for (const f of (list.result.files || [])) {
        const m = f.name.match(re);
        if (!m) continue;
        const [, s, v] = m;
        const content = await getFileTextById(f.id, f.mimeType);
        if (content) displayLoadedNote(s, v, content);
      }

      pageToken = list.result.nextPageToken || null;
    } while (pageToken);

  } catch (err) {
    console.error('Notları listeleme hatası:', err);
  }
}

/* ========= Yardımcılar ========= */
function isDriveReady() {
  return gapiInited && gisInited && isSignedIn && hasDriveGrant && !!folderId;
}

function clearAllNotes() {
  document.querySelectorAll('[id^="user-note-"]').forEach(el => {
    el.innerHTML = '';
    el.classList.add('hidden');
  });
}

function showNotification(message, type = 'info') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  alert(`${icons[type]} ${message}`);
}

/* ========= Çıkış ========= */
function signOut() {
  try {
    if (accessToken) google.accounts.oauth2.revoke(accessToken);
  } catch (e) {}
  google.accounts.id.disableAutoSelect();
  isSignedIn = false;
  hasDriveGrant = false;
  accessToken = null;
  folderId = null;
  updateAuthUI();
  clearAllNotes();
  showNotification('Çıkış yapıldı.', 'info');
}

/* ========= Global export ========= */
window.connectDrive   = connectDrive;
window.signOut        = signOut;
window.isDriveReady   = isDriveReady;
window.saveNoteToDrive= saveNoteToDrive;
window.loadNoteFromDrive = loadNoteFromDrive;
window.loadAllNotesFromDrive = loadAllNotesFromDrive;
window.getFileTextById = getFileTextById;
