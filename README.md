# Kuran Teyit

Kuran Teyit; Kuran metinlerini okuma, karşılaştırma, kelime/ayet araştırması ve kişisel not alma amacıyla geliştirilen web ve Android uygulamasıdır.

## Canlı Site

https://kuranteyit.com

## Başlıca Özellikler

- İngilizce ana metin öncelikli Kuran araştırması
- Türkçe destekli kelime araştırması
- Virgülle çoklu kelime / kavram araştırması
- İngilizce, Türkçe ve transliterasyon metinleri
- Arapça metin karşılaştırmaları
- Kelime sözlüğü ve bağlamsal sözlük desteği
- Ayet Analizi
- Kelime & Ayet Araştırma
- 38 Ek / Appendix içeriği
- Biçimli metin destekli Not Al sistemi
- Sesli okuma
- Tema seçenekleri
- PWA / Service Worker desteği
- Android / Capacitor sürümü

## Web Yayın Sistemi

Web sürümü GitHub üzerinden Cloudflare Workers Static Assets altyapısına otomatik olarak yayınlanır.

Canlı web sürümündeki:

`data/quran_tr.json`

dosyası build sırasında aşağıdaki açık kaynak depodan alınır:

`SubmitterTech/quran-tft`

Kaynak yol:

`app/src/assets/translations/tr/quran_tr.json`

Kaynak dosya doğrulanamazsa build durdurulur ve mevcut çalışan sürüm korunur.

Ayrı bir Cloudflare Cron Worker, kaynak Türkçe Kuran dosyasını düzenli olarak kontrol eder. Kaynak değişmişse Kuran Teyit yeniden build edilerek güncel dosya otomatik olarak yayınlanır.

## Android

Android kaynakları ve imzalama süreçleri web repository'sinden ayrı yönetilir.

Keystore, APK/AAB, Android build çıktıları ve diğer hassas dosyalar bu public repository'ye dahil edilmez.

## Lisanslar

Üçüncü taraf kaynaklar ve ilgili bildirimler için:

- `licenses.html`
- `THIRD_PARTY_NOTICES.txt`

dosyalarına bakınız.