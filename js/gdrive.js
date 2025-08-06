const GDRIVE_CONFIG = {
    CLIENT_ID: '531554591019-2rshc2099esb0mivhu2t0o8rg6lfs1if.apps.googleusercontent.com',
    API_KEY: 'AIzaSyB53htFfTz7dsIIx2J1RRoQ-i0PiyFKwG4',
    FOLDER_NAME: 'Kuran_Teyit_Not',
    SCOPES: 'https://www.googleapis.com/auth/drive.file'
};

let gapiInited = false;
let gisInited = false;
let tokenClient;
let folderId = null;
let accessToken = null;
let isSignedIn = false;

function gapiLoaded() {
    console.log("GAPI yüklendi.");
    gapi.load('client', initializeGapiClient);
}

function gisLoaded() {
    console.log("GIS yüklendi.");
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GDRIVE_CONFIG.CLIENT_ID,
        scope: GDRIVE_CONFIG.SCOPES,
        callback: handleTokenResponse
    });
    google.accounts.id.initialize({
        client_id: GDRIVE_CONFIG.CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false
    });
    gisInited = true;
    renderSignInButton();
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            apiKey: GDRIVE_CONFIG.API_KEY,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
        });
        gapiInited = true;
        console.log("GAPI client başlatıldı.");
    } catch (error) {
        console.error("GAPI başlatma hatası:", error);
        showNotification("Google API başlatılamadı!", "error");
    }
}

function renderSignInButton() {
    const signInDiv = document.getElementById('g_id_signin');
    if (signInDiv && gisInited) {
        google.accounts.id.renderButton(signInDiv, {
            type: 'standard',
            size: 'medium',
            theme: 'outline',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left'
        });
    }
}

function handleCredentialResponse(response) {
    console.log("Google giriş başarılı, token alınıyor...");
    if (!gapiInited) {
        console.warn("GAPI henüz hazır değil, bekleniyor...");
        setTimeout(() => handleCredentialResponse(response), 1000);
        return;
    }
    if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }
}

async function handleTokenResponse(tokenResponse) {
    if (tokenResponse.error) {
        console.error("Token hatası:", tokenResponse.error);
        showNotification("Google giriş hatası!", "error");
        return;
    }
    accessToken = tokenResponse.access_token;
    isSignedIn = true;
    updateAuthUI(true);
    await initializeDrive();
    showNotification("Google hesabına başarıyla giriş yapıldı!", "success");
}

function updateAuthUI(signedIn) {
    const signInButton = document.getElementById('g_id_signin');
    const signOutButton = document.getElementById('logoutBtn');
    if (signedIn) {
        if (signInButton) signInButton.style.display = 'none';
        if (signOutButton) {
            signOutButton.style.display = 'inline-block';
            signOutButton.classList.remove('hidden');
        }
    } else {
        if (signInButton) signInButton.style.display = 'block';
        if (signOutButton) {
            signOutButton.style.display = 'none';
            signOutButton.classList.add('hidden');
        }
    }
}

async function initializeDrive() {
    if (!gapiInited || !accessToken) {
        console.warn("Drive başlatılamıyor - GAPI veya token eksik");
        return;
    }
    try {
        await ensureFolder();
        await loadAllNotesFromDrive();
        console.log("Drive başarıyla başlatıldı.");
    } catch (error) {
        console.error("Drive başlatma hatası:", error);
        showNotification("Google Drive bağlantı hatası!", "error");
    }
}

async function ensureFolder() {
    if (!gapiInited || !accessToken) {
        console.warn("ensureFolder: API hazır değil");
        return;
    }
    try {
        console.log("Klasör kontrol ediliyor...");
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${GDRIVE_CONFIG.FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id,name)',
            spaces: 'drive'
        });
        if (searchResponse.result.files && searchResponse.result.files.length > 0) {
            folderId = searchResponse.result.files[0].id;
            console.log("Klasör bulundu:", folderId);
        } else {
            const createResponse = await gapi.client.drive.files.create({
                resource: {
                    name: GDRIVE_CONFIG.FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            folderId = createResponse.result.id;
            console.log("Yeni klasör oluşturuldu:", folderId);
        }
    } catch (error) {
        console.error("Klasör işlemi hatası:", error);
        showNotification("Klasör oluşturma hatası!", "error");
    }
}

async function saveNoteToDrive(sura, verse, noteContent) {
    if (!isSignedIn || !folderId) {
        showNotification("Google hesabına giriş yapın!", "warning");
        return false;
    }
    if (!noteContent.trim()) {
        showNotification("Not içeriği boş olamaz!", "warning");
        return false;
    }
    const fileName = `${sura}_${verse}.txt`;
    try {
        console.log(`Not kaydediliyor: ${fileName}`);
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id,name)',
            spaces: 'drive'
        });
        let fileId = null;
        if (searchResponse.result.files && searchResponse.result.files.length > 0) {
            fileId = searchResponse.result.files[0].id;
        }
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const close_delim = `\r\n--${boundary}--`;
        let multipartRequestBody;
        let method;
        let path;
        if (fileId) {
            multipartRequestBody = 
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                '{}' +
                delimiter +
                'Content-Type: text/plain\r\n\r\n' +
                noteContent +
                close_delim;
            method = 'PATCH';
            path = `/upload/drive/v3/files/${fileId}`;
        } else {
            const metadata = {
                name: fileName,
                parents: [folderId],
                mimeType: 'text/plain'
            };
            multipartRequestBody = 
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: text/plain\r\n\r\n' +
                noteContent +
                close_delim;
            method = 'POST';
            path = '/upload/drive/v3/files';
        }
        const response = await gapi.client.request({
            path: path,
            method: method,
            params: { uploadType: 'multipart' },
            headers: {
                'Content-Type': `multipart/related; boundary="${boundary}"`
            },
            body: multipartRequestBody
        });
        console.log("Not başarıyla kaydedildi:", response.result.id);
        showNotification(fileId ? "Not güncellendi!" : "Not kaydedildi!", "success");
        return true;
    } catch (error) {
        console.error("Not kaydetme hatası:", error);
        showNotification("Not kaydedilirken hata oluştu!", "error");
        return false;
    }
}

async function loadNoteFromDrive(sura, verse) {
    if (!isSignedIn || !folderId) return '';
    const fileName = `${sura}_${verse}.txt`;
    try {
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${fileName}' and '${folderId}' in parents and trashed=false`,
            fields: 'files(id,name)',
            spaces: 'drive'
        });
        if (!searchResponse.result.files || searchResponse.result.files.length === 0) return '';
        const fileId = searchResponse.result.files[0].id;
        const contentResponse = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        return contentResponse.body || '';
    } catch (error) {
        console.error("Not yükleme hatası:", error);
        return '';
    }
}

async function loadAllNotesFromDrive() {
    if (!isSignedIn || !folderId) return;
    try {
        console.log("Tüm notlar yükleniyor...");
        const listResponse = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and trashed=false and name contains '.txt'`,
            fields: 'files(id,name)',
            spaces: 'drive'
        });
        if (!listResponse.result.files || listResponse.result.files.length === 0) {
            console.log("Kaydedilmiş not bulunamadı.");
            return;
        }
        console.log(`${listResponse.result.files.length} not dosyası bulundu.`);
        for (const file of listResponse.result.files) {
            const fileName = file.name;
            const match = fileName.match(/^(\d+)_(\d+)\.txt$/);
            if (match) {
                const [, sura, verse] = match;
                try {
                    const content = await loadNoteFromDrive(sura, verse);
                    if (content) displayLoadedNote(sura, verse, content);
                } catch (error) {
                    console.error(`Not yüklenemedi: ${fileName}`, error);
                }
            }
        }
        console.log("Tüm notlar yüklendi.");
    } catch (error) {
        console.error("Notları yükleme hatası:", error);
    }
}

function displayLoadedNote(sura, verse, content) {
    const noteElement = document.getElementById(`user-note-${sura}-${verse}`);
    if (noteElement) {
        noteElement.innerHTML = `<div class="note-box saved-note">${content}</div>`;
        noteElement.classList.remove('hidden');
    }
}

function signOut() {
    try {
        if (accessToken) {
            google.accounts.oauth2.revoke(accessToken);
            accessToken = null;
        }
        google.accounts.id.disableAutoSelect();
        isSignedIn = false;
        folderId = null;
        updateAuthUI(false);
        clearAllNotes();
        showNotification("Çıkış yapıldı.", "info");
    } catch (error) {
        console.error("Çıkış hatası:", error);
    }
}

function clearAllNotes() {
    document.querySelectorAll('[id^="user-note-"]').forEach(element => {
        element.innerHTML = '';
        element.classList.add('hidden');
    });
}

function showNotification(message, type = 'info') {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    alert(`${icons[type]} ${message}`);
}

function isDriveReady() {
    return gapiInited && gisInited && isSignedIn && folderId;
}
