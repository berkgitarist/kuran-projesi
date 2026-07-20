# Kuran Teyit v43 — Google Play Yayın Kontrol Listesi

Bu belge teknik ve içeriksel bir hazırlık listesidir; Google Play onayı garantisi değildir. Play Console'daki güncel politika ekranları yayın öncesinde yeniden kontrol edilmelidir.

## 1. Android hedef API düzeyi

- 31 Ağustos 2026'dan itibaren yeni uygulama ve güncellemelerde Android 16 / API 36 veya üzeri hedeflenmelidir.
- Android Studio projesinde `compileSdk` ve `targetSdk` değerlerini kontrol edin.
- Capacitor veya Cordova bağımlılıklarının API 36 ile uyumlu güncel sürümlerini kullanın.

## 2. Gizlilik Politikası

- Gizlilik Politikası uygulama menüsünde erişilebilir durumdadır.
- Play Console'a ayrıca herkese açık, çalışan ve uygulamayla aynı bilgileri içeren bir Gizlilik Politikası URL'si girilmelidir.
- Politika; yerel notları, ayarları, çevrimdışı önbelleği, Arapça ses isteğini, paylaşım/pano işlemini ve harici bağlantıları açıklamalıdır.

## 3. Veri Güvenliği formu

- Uygulamanın ve Android projesine eklenen tüm SDK'ların davranışını kontrol edin.
- Reklam, analiz, çökme raporlama veya başka SDK eklenirse Veri Güvenliği formunu güncelleyin.
- Uygulama içi politika, mağaza beyanı ve gerçek teknik davranış birbiriyle aynı olmalıdır.

## 4. Uygulama açıklaması ve ekran görüntüleri

- Mağaza açıklamasında yalnızca gerçekten çalışan özellikleri yazın.
- “Resmî”, “kesin”, “hatasız”, “fetva verir” veya kaynak kuruluşlarla bağlantı ima eden ifadeler kullanmayın.
- Uygulamanın bağımsız araştırma aracı olduğu açıkça belirtilmelidir.
- Ekran görüntüleri güncel arayüzü ve gerçek işlevleri göstermelidir.

## 5. AI çeviri alanı

- Mevcut AI çeviri alanı canlı üretken AI veya chatbot değildir; paket içindeki statik deneysel metindir.
- Alan kullanıcıya “AI ÇEVİRİ” olarak açıkça etiketlenmiştir.
- Resmî meal, dinî hüküm veya kesin yorum olarak tanıtılmamalıdır.
- İleride kullanıcı istemiyle içerik üreten canlı AI eklenirse Google Play AI içeriği politikası, güvenlik filtreleri ve uygulama içi bildirim/raporlama gereksinimleri yeniden değerlendirilmelidir.

## 6. İçerik hakları ve kaynaklar

- Her meal, çeviri, dipnot, sözlük ve ses kaynağı için lisans veya yazılı kullanım izni kayıtlarını saklayın.
- GitHub'da herkese açık olmanın yeniden dağıtım izni anlamına gelmediğini unutmayın.
- Uygulama içindeki “Lisanslar ve Kaynaklar” sayfasını güncel tutun.

## 7. Ses ve internet kullanımı

- Arapça ses yalnızca kullanıcı oynat düğmesine dokunduğunda internetten yüklenir.
- Android manifestinde yalnızca gerçekten kullanılan izinleri bırakın.
- Kamera, mikrofon, konum, kişi listesi veya depolama izni kullanılmıyorsa manifestten kaldırın.

## 8. Not yedekleme

- Notların cihazda yerel saklandığı ve uygulama silindiğinde kaybolabileceği açıklanmıştır.
- JSON dışa/içe aktarma kullanıcı işlemiyle çalışır.
- Android'in yeni dosya seçici ve paylaşım yöntemleri kullanılıyorsa geniş depolama izni istemeyin.

## 9. Uygulama paketi ve test

- Google Play için Android App Bundle (`.aab`) üretin.
- En az bir gerçek Android cihazda temiz kurulum ve güncelleme testi yapın.
- İnternet açık/kapalı, koyu/açık tema, geri hareketi, ses, not yedekleme ve kılavuz sayfasını test edin.
- Play Console ön yayın raporundaki çökme, ANR, erişilebilirlik ve güvenlik sonuçlarını inceleyin.

## 10. Yayın öncesi son kontrol

- Sürüm kodunu (`versionCode`) artırın.
- Kullanıcıya gösterilen sürüm adını (`versionName`) güncelleyin.
- “Yenilikler” alanında kılavuz, gezinme, çevrimdışı kullanım ve gizlilik güncellemelerini doğru şekilde açıklayın.
- Gizlilik Politikası URL'sinin oturum açmadan ve mobil tarayıcıda açıldığını doğrulayın.
