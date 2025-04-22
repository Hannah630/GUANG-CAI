// ✅ 引入模組
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3000;

// 🔧 中介軟體設定
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ 靜態網站來源（HTML 放這）
app.use(express.static('docs'));

// 📦 資料庫連線設定
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

// ✅ 會員登入 API
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

// ✅ 查詢訂單列表 API（老闆用）
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


// ✅ NewebPay 測試金流設定（請用你自己的測試參數）
const MERCHANT_ID = 'MS123456789';
const HASH_KEY = '12345678901234567890123456789012';
const HASH_IV = '1234567890123456';

// 🧾 NewebPay 付款 API
app.post('/newebpay', (req, res) => {
  const { MerchantOrderNo, Amt, ItemDesc } = req.body;

  const tradeInfo = {
    MerchantID: MERCHANT_ID,
    RespondType: 'JSON',
    TimeStamp: Math.floor(Date.now() / 1000),
    Version: '2.0',
    MerchantOrderNo,
    Amt,
    ItemDesc,
    ReturnURL: 'https://www.google.com' // ✅ 上線時請改為自己的 thankyou.html
  };

  // Step 1: 轉為 query string
  const query = new URLSearchParams(tradeInfo).toString();

  // Step 2: AES 加密
  const cipher = crypto.createCipheriv('aes-256-cbc', HASH_KEY, HASH_IV);
  let encrypted = cipher.update(query, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Step 3: SHA256 雜湊簽章
  const hash = crypto.createHash('sha256');
  hash.update(`HashKey=${HASH_KEY}&${encrypted}&HashIV=${HASH_IV}`);
  const tradeSha = hash.digest('hex').toUpperCase();

  // Step 4: 自動送出付款表單
  res.send(`
    <form id="payForm" method="post" action="https://ccore.newebpay.com/MPG/mpg_gateway">
      <input type="hidden" name="MerchantID" value="${MERCHANT_ID}" />
      <input type="hidden" name="TradeInfo" value="${encrypted}" />
      <input type="hidden" name="TradeSha" value="${tradeSha}" />
      <input type="hidden" name="Version" value="2.0" />
    </form>
    <script>document.getElementById('payForm').submit();</script>
  `);
});

// 🚀 啟動伺服器
app.listen(port, () => {
  console.log(`🚀 伺服器正在 http://localhost:${port} 上運行`);
});
