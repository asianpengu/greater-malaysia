// assets/i18n.js — load before common.js on every page.
const GM_I18N = {
  fetchingPrayer: { en: "Fetching prayer times…", ms: "Mengambil waktu solat…", zh: "正在获取祈祷时间…" },
  errPrayerRetry: { en: "Couldn't reach JAKIM e-Solat. Retry shortly.", ms: "Tidak dapat menghubungi JAKIM e-Solat. Cuba sebentar lagi.", zh: "无法连接 JAKIM e-Solat,请稍后重试。" },
  errPrayerRefresh: { en: "Couldn't reach JAKIM e-Solat. Refresh shortly.", ms: "Tidak dapat menghubungi JAKIM e-Solat. Muat semula sebentar lagi.", zh: "无法连接 JAKIM e-Solat,请稍后刷新。" },
  errFuel: { en: "Couldn't reach data.gov.my fuel feed.", ms: "Tidak dapat menghubungi suapan harga minyak data.gov.my.", zh: "无法连接 data.gov.my 油价数据源。" },
  errPopulation: { en: "Couldn't reach DOSM population feed.", ms: "Tidak dapat menghubungi suapan populasi DOSM.", zh: "无法连接 DOSM 人口数据源。" },
  fetchingRates: { en: "Fetching rates…", ms: "Mengambil kadar…", zh: "正在获取汇率…" },
  errFx: { en: "Couldn't reach the FX feed.", ms: "Tidak dapat menghubungi suapan pertukaran wang.", zh: "无法连接外汇数据源。" },
  errCoinGecko: { en: "Couldn't reach CoinGecko.", ms: "Tidak dapat menghubungi CoinGecko.", zh: "无法连接 CoinGecko。" },
  fetchingWeather: { en: "Reading the skies over {city}…", ms: "Membaca cuaca di {city}…", zh: "正在读取{city}的天气…" },
  errWeather: { en: "Couldn't reach Open-Meteo.", ms: "Tidak dapat menghubungi Open-Meteo.", zh: "无法连接 Open-Meteo。" },
  errWarnings: { en: "Couldn't reach the warnings feed.", ms: "Tidak dapat menghubungi suapan amaran.", zh: "无法连接预警数据源。" },
  errInflation: { en: "Couldn't reach the inflation feed.", ms: "Tidak dapat menghubungi suapan inflasi.", zh: "无法连接通胀数据源。" },
};

function t(key, vars) {
  const htmlLang = document.documentElement.lang;
  const lang = htmlLang === "ms" ? "ms" : htmlLang === "zh-Hans" ? "zh" : "en";
  const entry = GM_I18N[key];
  if (!entry) return key;
  let str = entry[lang] || entry.en;
  if (vars) for (const k in vars) str = str.replace(`{${k}}`, vars[k]);
  return str;
}
