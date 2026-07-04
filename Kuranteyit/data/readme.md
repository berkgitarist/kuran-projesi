# 🕌 Kuran Çalışma Uygulaması

Firebase entegreli modern Kuran çalışma uygulaması. Ayetler üzerinden not alabilir, notlarınızı Google hesabınızla senkronize edebilirsiniz.

## ✨ Özellikler

- 📖 **Kuran Ayetleri**: Arapça, transkripsiyon, İngilizce ve Türkçe çeviriler
- ✍️ **Not Alma**: Her ayet için detaylı not alma sistemi
- ☁️ **Cloud Sync**: Google hesabı ile otomatik senkronizasyon
- 📱 **Responsive**: Mobil ve masaüstü uyumlu tasarım
- 🔄 **Offline Support**: İnternet olmadığında da çalışır
- 📊 **İstatistikler**: Not alma istatistikleri ve analiz
- 🎨 **Modern UI**: Glassmorphism ve modern tasarım

## 🚀 Hızlı Başlangıç

### 1. Dosyaları İndirin

```bash
git clone https://github.com/kullaniciadi/kuran-calismasi.git
cd kuran-calismasi
```

### 2. Firebase Projesi Oluşturun

1. [Firebase Console](https://console.firebase.google.com/)'a gidin
2. "Create a project" ile yeni proje oluşturun
3. Proje adını girin (örn: `kuran-calismasi`)

### 3. Firebase Servislerini Aktifleştirin

#### Authentication

- Authentication > Get started
- Sign-in method > Google > Enable
- Authorized domains'e domain'inizi ekleyin

#### Firestore Database

- Firestore Database > Create database
- Start in test mode (başlangıç için)
- Location: `europe-west3` (Türkiye için önerilen)

### 4. Web App Yapılandırması

1. Project Settings (⚙️) > General
2. Your apps > Web app (+) tıklayın
3. App nickname girin
4. Config object'i kopyalayın

### 5. Yapılandırma Dosyasını Güncelleyin

`firebase-config.js` dosyasındaki `firebaseConfig` değişkenini güncelleyin:

```javascript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "your-app-id",
};
```

### 6. Firestore Güvenlik Kuralları

Firestore Database > Rules bölümüne şu kuralları ekleyin:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Kullanıcılar sadece kendi notlarını görebilir/düzenleyebilir
    match /notes/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /verses/{verseId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

### 7
