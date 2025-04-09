const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const port = 3000;

// 🔧 中介軟體設定
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ 留言查詢 API（放在 static 前面，避免被攔截）
app.get('/messages', (req, res) => {
  const sql = 'SELECT * FROM contact_messages ORDER BY created_at DESC';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('❌ 查詢留言失敗:', err);
      return res.status(500).json({ error: '伺服器錯誤' });
    }
    res.json(results);
  });
});

// ✅ 靜態網站來源（public html, css, js...）
app.use(express.static('docs'));

// 📦 資料庫連線設定
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // 這裡要輸入密碼，如果有的話
  database: 'member_db'
});

db.connect(err => {
  if (err) {
    console.error('❌ 資料庫連線失敗:', err);
    throw err;
  }
  console.log('✅ 成功連接到資料庫');
});

// 📝 留言表單處理
app.post('/contact', (req, res) => {
  const { name, phone, email, god, source, message } = req.body;

  const sql = `
    INSERT INTO contact_messages (name, phone, email, god, source, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.execute(sql, [name, phone, email, god, source, message], (err, result) => {
    if (err) {
      console.error('❌ 留言儲存失敗:', err);
      return res.status(500).send('❌ 留言失敗，請稍後再試');
    }

    res.send('✅ 已成功送出留言，感謝您的回覆！');
  });
});

// 🧾 註冊處理
app.post('/register', async (req, res) => {
  const { name, address, phone, god, temple, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users (name, address, phone, god, temple, email, password)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.execute(sql, [name, address, phone, god, temple, email, hashedPassword], (err, result) => {
      if (err) {
        console.error('❌ 註冊錯誤:', err);
        return res.send('❌ 註冊失敗：信箱已被使用或資料錯誤');
      }
      res.send('✅ 註冊成功！請返回首頁登入');
    });
  } catch (err) {
    console.error('❌ 密碼加密錯誤:', err);
    res.send('❌ 伺服器錯誤，請稍後再試');
  }
});

// 🔐 登入處理
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM users WHERE email = ?';
  db.execute(sql, [email], async (err, results) => {
    if (err) {
      console.error('❌ 查詢資料庫失敗:', err);
      return res.send('❌ 登入錯誤，請稍後再試');
    }

    if (results.length === 0) {
      return res.send('❌ 此帳號不存在');
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.send('❌ 密碼錯誤');
    }

    // 登入成功導向會員頁
    res.redirect('/pages/member.html');
  });
});

// 🚀 啟動伺服器
app.listen(port, () => {
  console.log(`🚀 伺服器正在 http://localhost:${port} 上運行`);
});
