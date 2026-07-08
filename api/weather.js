/* Current weather + US air-quality index, from Open-Meteo. */
const CITIES = { "kuala-lumpur": [3.139, 101.687], "putrajaya": [2.926, 101.696], "selangor": [3.073, 101.518], "pulau-pinang": [5.414, 100.329], "penang": [5.414, 100.329], "george-town": [5.414, 100.329], "johor-bahru": [1.4927, 103.7414], "ipoh": [4.5975, 101.0901], "kuching": [1.5533, 110.3592], "kota-kinabalu": [5.9804, 116.0735], "melaka": [2.1896, 102.2501], "kuantan": [3.8168, 103.3315], "kota-bharu": [6.1254, 102.2381] };
const WX = { 0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 61: "light rain", 63: "rain", 65: "heavy rain", 80: "showers", 81: "showers", 82: "violent showers", 95: "thunderstorm", 96: "thunderstorm", 99: "thunderstorm" };
const aqiLabel = (v) => v <= 50 ? "Good" : v <= 100 ? "Moderate" : v <= 150 ? "Unhealthy for sensitive groups" : v <= 200 ? "Unhealthy" : v <= 300 ? "Very unhealthy" : "Hazardous";
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=900, s-maxage=900");
  if (req.method === "OPTIONS") return res.status(204).end();
  const city = (req.query.city || "kuala-lumpur").toLowerCase();
  const c = CITIES[city] || CITIES["kuala-lumpur"];
  try {
    const [w, a] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c[0]}&longitude=${c[1]}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=Asia%2FKuala_Lumpur`).then((r) => r.json()),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${c[0]}&longitude=${c[1]}&current=us_aqi&timezone=Asia%2FKuala_Lumpur`).then((r) => r.json())
    ]);
    const cur = w.current || {};
    const aqi = Math.round((a.current || {}).us_aqi);
    res.status(200).json({
      dataset: "Current weather and air quality",
      city, temperature_c: Math.round(cur.temperature_2m), humidity_pct: Math.round(cur.relative_humidity_2m),
      condition: WX[cur.weather_code] || "unknown", air_quality: { us_aqi: aqi, label: aqiLabel(aqi) },
      source: { name: "Open-Meteo", url: "https://open-meteo.com", retrieved: new Date().toISOString() },
      provider: "Greater Malaysia (greatermalaysia.com)"
    });
  } catch (e) {
    res.status(502).json({ error: "upstream unavailable", source: "Open-Meteo", city });
  }
}
