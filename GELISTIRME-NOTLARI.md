# Kuran Teyit v43 — Temiz URL ve Manuel İlk Ayet Ekranı

Bu paket, mevcut çalışan sürüm temel alınarak hazırlanmıştır. CSS dosyası bölünmemiştir; yalnızca yeni özelliklerin ihtiyaç duyduğu küçük stiller aynı `style.css` dosyasının sonuna eklenmiştir.

## Uygulanan geliştirmeler

- Tema sınıfları `<html>` ve `<body>` üzerinde senkron yönetiliyor.
- Geçersiz ayet ve sayfa yönlendirmeleri güvenli biçimde engelleniyor.
- Ayet, sayfa ve analiz yönlendirmeleri merkezî gezinme sistemi üzerinden çalışıyor.
- Paylaşılabilir URL bağlantıları destekleniyor: `#ayet=17:36` ve `#analiz=17:36`. Normal sayfa numaraları URL’ye yazılmaz.
- Tarayıcı/Android geri hareketi analiz ve ayet geçmişiyle uyumlu çalışıyor.
- Ayetler için Paylaş düğmesi eklendi.
- AI, sözlük, analiz haritaları ve karşılaştırmalı Arapça verileri ihtiyaç halinde yükleniyor.
- Konu haritaları bir kez indeksleniyor; her analizde baştan taranmıyor.
- Arama kelime indeksi kullanıyor ve 180 ms beklemeli çalışıyor.
- Meal dosyaları yüklenirken ortak ayet indeksine dönüştürülüyor.
- Eski arama/analiz isteğinin yeni ekranı bozması engelleniyor.
- JavaScript bağımsız modüllere ayrılmaya başlandı.
- HTML içi `onclick` ve `ontoggle` kullanımları tamamen kaldırıldı.
- Kullanılmayan kod ve durum alanları temizlendi.
- Analiz ve arama panelleri erişilebilir dialog olarak çalışıyor.
- `alert()` yerine kapanabilir bildirim sistemi eklendi.
- Açılış ekranı hızlandırıldı ve “Uygulamaya Geç” düğmesi eklendi.
- Hareket azaltma tercihi destekleniyor.
- Not içe aktarma dosya boyutu, veri tipi, ayet ve içerik uzunluğu bakımından doğrulanıyor.
- Zorunlu ve isteğe bağlı veri hataları ayrı yönetiliyor.
- Otomatik testler eklendi.
- PWA manifesti ve çevrimdışı önbellek servisi eklendi.

## Projeye ekleme

Mevcut projenizin yedeğini aldıktan sonra bu paketteki dosyaları aynı klasör yapısıyla kopyalayın:

- `index.html`
- `css/style.css`
- `js/script.js`
- `js/modules/` klasörünün tamamı
- `manifest.webmanifest`
- `service-worker.js`

Mevcut `assets/` ve `data/` klasörlerinizi silmeyin. Paket bunların yerine geçmez.

JavaScript artık ES modülü olarak çalıştığı için projeyi HTTP/HTTPS, Capacitor veya Android WebView uygulama sunucusu üzerinden açın. `index.html` dosyasını bilgisayarda doğrudan `file://` adresiyle açmak bazı tarayıcılarda modül güvenlik kısıtlamasına takılabilir.

## Önerilen test sırası

1. Uygulamanın ilk açılışı ve Fatiha sayfası.
2. Bütün temaların tek tek seçilmesi.
3. Üst ve alt sayfa okları.
4. Arama alanına `17:36` yazılması.
5. Bir ayetin Analiz ekranının açılması.
6. Analizde referans ayete gidilmesi ve sol okla analize dönülmesi.
7. Tarayıcı veya Android geri tuşunun denenmesi.
8. Meal alanının ilk kez açılması.
9. Arapça alanının açılıp karşılaştırma ve kelime verilerinin yüklenmesi.
10. Kelime yardımının masaüstü ve dokunmatik cihazda denenmesi.
11. Not kaydetme, düzenleme, silme, dışa ve içe aktarma.
12. Bozuk veya 2 MB üzerinde not dosyasının reddedilmesi.
13. Ayet Paylaş düğmesi.
14. İnternet kapatılarak daha önce açılmış içeriklerin tekrar denenmesi.

## Otomatik test

Node.js bulunan geliştirme ortamında:

```bash
npm test
```

Testler yardımcı fonksiyonları, ayet referanslarını, URL rotalarını, meal normalizasyonunu, not doğrulamasını ve inline event handler bulunmamasını kontrol eder.


## v43 temiz URL ve manuel özel ekran

- Açılış ekranı ilk ve sonraki açılışlarda 3000 ms gösterilir.
- Normal Kur’an sayfası geçişleri URL’ye `#sayfa=` eklemez.
- “İlk İnen Ayet” ekranı URL’ye `#ilk-ayet` eklemeden uygulama içi manuel ekran olarak çalışır.
- Fatiha’dan önce ve Nas Suresi’nden sonra aynı özel ekran açılır.
- Özel ekrandayken sol ok Nas Suresi’ne, sağ ok Fatiha Suresi’ne gider.
- Ayet paylaşımı ve analiz bağlantıları için `#ayet=` ve `#analiz=` desteği korunur.
- Service Worker yalnızca proje kökünde bulunmalıdır; `js/modules` altında kopyası olmamalıdır.
