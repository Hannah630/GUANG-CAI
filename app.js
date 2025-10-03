// ✅ 引入模組
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

const app = express();
const port = process.env.PORT || 3000;

// ✅ 中介軟體設定
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'docs')));

// ✅ 資料庫連線
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT, // 別忘了加 port
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('❌ 資料庫連線失敗:', err);
    return;
  }
  console.log('✅ 成功連接到資料庫');

  // ✅ 建立資料表（只會跑一次）
  db.query(`
    CREATE TABLE IF NOT EXISTS member (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      address VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      god VARCHAR(50),
      temple VARCHAR(100),
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL
    )
  `, err => {
    if (err) {
      console.error('❌ 建立資料表失敗:', err.message);
    } else {
      console.log('✅ 資料表 member 已確認存在');
    }
  });
});

// ✅ Gmail 寄信
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// ✅ Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ✅ 首頁
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

// ✅ 會員註冊
app.post('/register', async (req, res) => {
  const { name, address, phone, god, temple, email, password, confirmPassword } = req.body;

  if (!name || !address || !phone || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: '請填寫所有必填欄位' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: '密碼與確認密碼不一致' });
  }

  db.query('SELECT * FROM member WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });

    if (results.length > 0) {
      return res.status(400).json({ error: '此 Email 已被註冊' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.query(
        'INSERT INTO member (name, address, phone, god, temple, email, password) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, address, phone, god || null, temple || null, email, hashedPassword],
        err => {
          if (err) return res.status(500).json({ error: '註冊失敗' });
          res.json({ message: '註冊成功！' });
        }
      );
    } catch (err) {
      console.error('❌ 加密失敗:', err);
      res.status(500).json({ error: '系統錯誤' });
    }
  });
});

// ✅ 登入
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM member WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });

    if (results.length === 0) return res.status(401).json({ error: '帳號不存在' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.status(401).json({ error: '密碼錯誤' });

    res.json({ message: '登入成功', name: user.name });
  });
});

// ✅ 客戶留言（Email＋簡訊）
app.post('/contact', (req, res) => {
  const { name, phone, email, god, source, message } = req.body;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.GMAIL_USER,
    replyTo: email,
    subject: `💌 客戶留言：${name}`,
    text: `留言內容：\n${message}\n聯絡電話：${phone}\n信箱：${email}`
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) {
      console.error('❌ 寄信失敗:', err);
      return res.status(500).send('留言成功但通知信失敗');
    }

    twilioClient.messages.create({
      body: `📩 有新留言：${name}\n${phone}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.MY_PHONE_NUMBER
    }).then(() => {
      res.send('留言成功，已通知！');
    }).catch(smsErr => {
      console.error('❌ 簡訊失敗:', smsErr);
      res.send('留言成功但簡訊發送失敗');
    });
  });
});

// ✅ 啟動伺服器
app.listen(port, () => {
  console.log(`🚀 Server is running at http://localhost:${port}`);
});
