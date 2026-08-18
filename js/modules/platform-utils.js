/* =========================================================
   KURAN TEYİT — PLATFORM UYUMLULUK YARDIMCILARI

   Web sürümü tarayıcı davranışını korur.
   Capacitor/Android sürümü ise iç bağlantıları aynı WebView içinde
   açar ve Android geri tuşunu web geçmişiyle eşleştirir.
========================================================= */

let nativeBackButtonRegistration = null;
let nativeInternalLinkHandlingReady = false;

export function isNativeAndroid() {
  const capacitor = window.Capacitor;

  if (!capacitor || typeof capacitor.getPlatform !== 'function') {
    return false;
  }

  const isAndroid = capacitor.getPlatform() === 'android';
  const isNative = typeof capacitor.isNativePlatform === 'function'
    ? capacitor.isNativePlatform()
    : true;

  return isAndroid && isNative;
}

export function openInternalPage(url, options = {}) {
  const {
    newTabOnWeb = true
  } = options;

  if (isNativeAndroid()) {
    window.location.assign(url);
    return;
  }

  if (newTabOnWeb) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  window.location.assign(url);
}

export function setupNativeSameWindowInternalLinks(root = document) {
  if (!isNativeAndroid() || nativeInternalLinkHandlingReady) {
    return false;
  }

  nativeInternalLinkHandlingReady = true;

  root.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;

    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download')) return;
    if (link.getAttribute('target') !== '_blank') return;

    let targetUrl;

    try {
      targetUrl = new URL(link.getAttribute('href'), window.location.href);
    } catch (error) {
      return;
    }

    // Yalnızca uygulamanın kendi HTML/route bağlantılarını aynı WebView'de aç.
    // Harici kaynak bağlantıları mevcut davranışını korur.
    if (targetUrl.origin !== window.location.origin) return;

    event.preventDefault();
    window.location.assign(targetUrl.href);
  }, true);

  return true;
}

export async function setupNativeBackButton(options = {}) {
  const {
    onBeforeBack = null
  } = options;

  if (!isNativeAndroid()) return false;

  const App = window.Capacitor?.Plugins?.App;
  if (!App?.addListener) {
    console.warn('Android geri tuşu için @capacitor/app eklentisi bulunamadı.');
    return false;
  }

  if (nativeBackButtonRegistration) {
    return nativeBackButtonRegistration;
  }

  try {
    const registrationResult = App.addListener('backButton', async ({ canGoBack }) => {
      try {
        if (typeof onBeforeBack === 'function') {
          const handled = await onBeforeBack();
          if (handled) return;
        }

        // WebView'in canGoBack bilgisine ek olarak HTML5 History API
        // (pushState/replaceState) geçmişini de hesaba kat. Kur'an Teyit
        // ayet/sayfa geçişlerinde pushState kullandığı için Android geri
        // tuşu bu sayede tek tek uygulama geçmişinde ilerler.
        const hasAppHistory = Boolean(canGoBack) || window.history.length > 1;

        if (hasAppHistory) {
          window.history.back();
          return;
        }

        // Gerçek başlangıç ekranındaysak uygulamayı zorla öldürmek yerine
        // Android ana ekranına küçült.
        if (typeof App.minimizeApp === 'function') {
          await App.minimizeApp();
          return;
        }

        if (typeof App.exitApp === 'function') {
          await App.exitApp();
        }
      } catch (error) {
        console.warn('Android geri tuşu işlenemedi:', error);

        if (Boolean(canGoBack) || window.history.length > 1) {
          window.history.back();
        }
      }
    });

    // window.Capacitor.Plugins üzerinden kullanılan native köprüde
    // addListener doğrudan { remove() } tutamacı döndürebilir. Paketlenmiş
    // @capacitor/app API'si ise Promise<PluginListenerHandle> döndürebilir.
    // İki çalışma biçimini de destekle.
    nativeBackButtonRegistration =
      registrationResult && typeof registrationResult.then === 'function'
        ? await registrationResult
        : registrationResult;

    return true;
  } catch (error) {
    nativeBackButtonRegistration = null;
    console.warn('Android geri tuşu dinleyicisi kurulamadı:', error);
    return false;
  }
}
