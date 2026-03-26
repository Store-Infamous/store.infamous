# ⚡ INFAMOUS AI v1.1

> **Full-Stack AI Chatbot SaaS** | Dark Hacker Theme | Powered by Google Gemini Pro

---

## 🧠 TECH STACK

| Layer        | Tech                          |
|-------------|-------------------------------|
| Frontend     | HTML5, CSS3, Vanilla JS        |
| Backend      | Node.js + Express.js           |
| Database     | MongoDB + Mongoose             |
| Auth         | JWT + bcrypt                   |
| AI API       | **Google Gemini 1.5 Pro**      |

---

## 📁 PROJECT STRUCTURE

```
infamous-ai/
├── backend/
│   ├── models/
│   │   ├── User.js          # User schema + plan logic
│   │   └── Chat.js          # Chat + message schema
│   ├── middleware/
│   │   └── auth.js          # JWT protect + adminOnly
│   ├── routes/
│   │   ├── auth.js          # /api/auth/* (login/signup/me)
│   │   ├── chat.js          # /api/chat/* (send/history/load/delete)
│   │   └── admin.js         # /api/admin/* (users/plans/stats)
│   ├── server.js            # Express app entry point
│   ├── .env.example         # Environment variable template
│   └── package.json
└── frontend/
    ├── index.html           # Single-page app
    ├── style.css            # Dark hacker theme
    └── script.js            # Full client-side logic
```

---

## 🚀 SETUP GUIDE

### 1. Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- Google Gemini API Key (free): https://aistudio.google.com/app/apikey

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/infamous_ai
JWT_SECRET=your_very_long_secret_key_here
GEMINI_API_KEY=your_gemini_api_key_here
ADMIN_EMAIL=aryan11222567@gmail.com
```

### 4. Run the Server
```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

### 5. Open the App
```
http://localhost:5000
```

---

## 🔐 AUTHENTICATION

- `POST /api/auth/signup` — Register (username, email, password)
- `POST /api/auth/login` — Login (email, password)
- `GET /api/auth/me` — Get current user (JWT required)

---

## 💬 CHAT API

- `POST /api/chat/send` — Send message → Gemini → Response
- `GET /api/chat/history` — Get all user chats
- `GET /api/chat/:id` — Load specific chat
- `DELETE /api/chat/:id` — Delete chat

---

## 📊 PLANS & LIMITS

| Plan     | Daily Msgs | Price (INR) |
|----------|-----------|-------------|
| Free     | 10        | ₹0          |
| Dirt     | 25        | ₹69         |
| Stone    | 50        | ₹149        |
| Obsidian | 80        | ₹229        |
| Bedrock  | 150       | ₹299        |

Limits reset every **24 hours** (server-side).

---

## 🛠️ ADMIN PANEL

Admin email: `aryan11222567@gmail.com`

Admin features:
- View all users + usage stats
- Change user plans
- Reset daily message limits
- Delete users
- View platform stats

**Admin routes** (JWT + admin check):
- `GET /api/admin/users`
- `GET /api/admin/stats`
- `PUT /api/admin/users/:id/plan`
- `PUT /api/admin/users/:id/reset`
- `DELETE /api/admin/users/:id`

---

## 💰 PAYMENT SYSTEM

Manual QR-based payment:
1. User selects plan in Upgrade Modal
2. QR code shown for payment
3. User sends payment screenshot to Discord ticket
4. Admin verifies and upgrades plan via Admin Panel

**To add your real UPI QR code:**
Replace the `.qr-placeholder` div in `index.html` with your actual QR image:
```html
<img src="your-upi-qr.png" alt="Pay via UPI" width="160" height="160" />
```

---

## 🔒 SECURITY

- API key stored only in `.env` (never in frontend)
- JWT for all authenticated routes
- bcrypt (salt rounds: 12) for passwords
- Admin routes double-protected (JWT + email check)
- CORS configured for production
- Input validation on all routes

---

## 🤖 AI CONFIGURATION

Model: **gemini-1.5-pro** (best for coding)

System prompt tuned for:
- Code generation & debugging
- Algorithm explanations
- Architecture advice
- Full-stack development

To change model, edit `backend/routes/chat.js`:
```js
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';
```

---

## 🎨 CUSTOMIZATION

- **Discord Link**: Edit `index.html` → `href="https://discord.gg/your-server"`
- **QR Code**: Replace placeholder in `.qr-placeholder`
- **Plans/Prices**: Edit `backend/models/User.js` → `PLAN_LIMITS`
- **Admin Email**: Edit `.env` → `ADMIN_EMAIL`

---

## 📦 PRODUCTION DEPLOYMENT

### Environment
```env
NODE_ENV=production
MONGO_URI=mongodb+srv://...atlas...
JWT_SECRET=<very-long-random-string>
```

### PM2
```bash
npm install -g pm2
pm2 start server.js --name infamous-ai
pm2 save
```

### Nginx (reverse proxy)
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## ⚠️ IMPORTANT NOTES

1. Never commit `.env` to Git (it's in `.gitignore`)
2. Change `JWT_SECRET` before production
3. Get Gemini API key: https://aistudio.google.com/app/apikey
4. For MongoDB Atlas, whitelist your server IP
5. The first signup with `ADMIN_EMAIL` auto-gets admin access

---

*Built with ⚡ by Infamous AI Team*
