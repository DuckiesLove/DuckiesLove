import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Datastore from 'nedb';

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret';

const tokenDB = new Datastore({ filename: 'tokens.db', autoload: true });

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'session-secret',
    resave: false,
    saveUninitialized: false,
  })
);

const destroy = (req, res) => {
  req.session.destroy(() =>
    res.status(401).json({ error: 'Authentication required' })
  );
};

app.post('/login', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return destroy(req, res);
  }

  tokenDB.find({ used: { $ne: true } }, async (err, docs) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    for (const doc of docs) {
      const match = await bcrypt.compare(token, doc.hash);
      if (match) {
        tokenDB.update({ _id: doc._id }, { $set: { used: true } }, {});
        const jwtToken = jwt.sign({ ip: req.ip }, JWT_SECRET, { expiresIn: '1h' });
        req.session.jwt = jwtToken;
        return res.json({ success: true });
      }
    }

    destroy(req, res);
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

const auth = (req, res, next) => {
  const { jwt: token } = req.session;
  if (!token) return destroy(req, res);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.ip !== req.ip) return destroy(req, res);
    next();
  } catch (e) {
    destroy(req, res);
  }
};

app.use(auth);
app.use(express.static(process.cwd()));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
