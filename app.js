require('dotenv').config();
// ✅ 引入模組
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const bcrypt = require('bcrypt');
const XLSX = require('xlsx');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

const app = express();
const port = 3000;

// ✅ 中介軟體設定
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ 靜態網站資料夾（放 HTML 等）
app.use(express.static(path.join(__dirname, 'docs')));

// ✅ 資料庫連線設定
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'member_db'
});

db.connect(err => {
  if (err) {
    console.error('❌ 資料庫連線失敗:', err);
    return;
  }
  console.log('✅ 成功連接到資料庫');
});

// ✅ Gmail 寄信設定
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// ✅ Twilio 簡訊設定
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ✅ 首頁路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs', 'index.html'));
});

// ✅ 會員註冊 API
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
        `INSERT INTO member (name, address, phone, god, temple, email, password)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, address, phone, god || null, temple || null, email, hashedPassword],
        (err, result) => {
          if (err) return res.status(500).json({ error: '註冊失敗，請稍後再試' });
          res.json({ message: '註冊成功！歡迎加入光彩繡莊 🙌' });
        }
      );
    } catch (error) {
      console.error('❌ 加密失敗:', error);
      res.status(500).json({ error: '密碼加密失敗' });
    }
  });
});

// ✅ 登入 API
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM member WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ error: '資料庫錯誤' });

    if (results.length === 0) {
      return res.status(401).json({ error: '帳號不存在' });
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: '密碼錯誤' });
    }

    res.json({ message: '登入成功', name: user.name });
  });
});

// ✅ 訂單報表 API
app.get('/orders', (req, res) => {
  const sql = 'SELECT * FROM orders ORDER BY created_at DESC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('❌ 查詢訂單失敗:', err);
      return res.status(500).json({ error: '伺服器錯誤' });
    }
    res.json(results);
  });
});

// ✅ 會員清單 API
app.get('/members', (req, res) => {
  const sql = 'SELECT id, name, address, phone, god, temple, email FROM member ORDER BY id DESC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('❌ 查詢會員資料失敗:', err);
      return res.status(500).json({ error: '伺服器錯誤' });
    }
    res.json(results);
  });
});

// ✅ 匯出訂單 Excel
app.get('/export-orders', (req, res) => {
  const sql = 'SELECT * FROM orders ORDER BY created_at DESC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('❌ 匯出失敗:', err);
      return res.status(500).send('資料匯出失敗');
    }

    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '訂單報表');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=orders.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  });
});

// ✅ 留言寄信 + 發簡訊 API
app.post('/contact', (req, res) => {
  const { name, phone, email, god, source, message } = req.body;

  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: process.env.GMAIL_USER,
    replyTo: email,
    subject: `💌 客戶留言：${name}`,
    text: `
📬 客戶留言通知：
--------------------
👤 姓名：${name}
📞 電話：${phone}
📧 Email：${email}
🙏 供奉神明：${god || '未填寫'}
📍 來源：${source || '未填寫'}
📝 留言內容：
${message}
    `
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('❌ 寄信失敗:', error);
      return res.status(500).send('留言成功，但通知信寄送失敗');
    }

    console.log('✅ 通知信已寄出:', info.response);

    // ✅ 簡訊通知（發送至你自己的手機）
    twilioClient.messages
    .create({
      body: `📩 光彩繡莊留言通知\n來自：${name}\n電話：${phone}\n留言內容：${message || '未填寫'}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.MY_PHONE_NUMBER
    })
    .then(msg => {
      console.log('✅ 簡訊已發送：', msg.sid);
      res.send('留言成功，我們已收到您的訊息！');
    })
    .catch(smsErr => {
      console.error('❌ 簡訊發送失敗:', smsErr);
      res.send('留言成功，但簡訊通知失敗');
    });
  });
});

// ✅ 啟動伺服器
app.listen(port, () => {
  console.log(`🚀 伺服器已啟動：http://localhost:${port}`);
});