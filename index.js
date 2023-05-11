const express = require('express');
const redis = require('redis');
const responseTime = require('response-time');
require('dotenv').config();

const app = express();

const port = process.env.PORT || 3000;
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const redisUsername = process.env.REDIS_USERNAME;
const redisPassword = process.env.REDIS_PASSWORD;

const client = redis.createClient({
  legacyMode: true,
  socket: {
    host: redisHost,
    port: redisPort,
  },
  username: redisUsername,
  password: redisPassword,
});

client.connect()

const isCached = (req, res, next) => {
  const fundname = req.params.fundname;
  client.get(fundname, (err, data) => {
    if (err) throw err;

    if (data !== null) {
        console.log(`Serving Cache`)
      res.json({ status: 'success', fundname, data });
    } else {
        
      next();
    }
  });
};

const getFundData = async (fundname) => {
  const data = await new Promise((resolve, reject) => {
    client.get(fundname, (err, data) => {
      if (err) reject(err);
      resolve(data);
    });
  });

  if (data !== null) {
    return data;
  } else {
    const currentTime = new Date().toISOString();
    console.log(`Setting Cache`)
    client.setEx(fundname, 10, currentTime,);
    return currentTime;
  }
};

app.use(responseTime());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ status: 'Server running' });
});

app.get('/fund/:fundname', isCached, async (req, res) => {
  const fundname = req.params.fundname;

  try {
    const data = await getFundData(fundname);
    res.json({ status: 'success', fundname, data });
  } catch (err) {no
    res.json({ status: 'error', message: err.message });
  }
});

app.use((req, res, next) => {
  const error = new Error('404 not found');
  error.status = 404;
  next(error);
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ status: err.message });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`client.isOpen: ${client.isOpen}`);
});