'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');

require('./schema');
const { seed } = require('./seed');
const { attachUser } = require('./auth');

const seedResult = seed();
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});
app.use(attachUser);

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'كان أمة', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/common', require('./routes/common'));
app.use('/api/student', require('./routes/student'));
app.use('/api/teacher', require('./routes/teacher'));
const manage = require('./routes/manage');
app.use('/api/admin', manage);
app.use('/api/supervisor', manage);

app.all('/api/*', (req, res) => res.status(404).json({ error: 'المسار المطلوب غير موجود.' }));

const DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: 'index.html', maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('/', (req, res) => res.type('html').send('<h1>كان أمة — لم يتم بناء الواجهة بعد (npm run build في client)</h1>'));
}

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[خطأ]', err.message);
  res.status(status).json({ error: err.status ? err.message : 'حدث خطأ غير متوقع في الخادم.' });
});

const PORT = Number(process.env.PORT || 4180);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`✅ كان أمة — الخادم يعمل على http://${HOST}:${PORT}${seedResult.seeded ? ' (تم تثبيت البيانات التأسيسية)' : ''}`);
});
