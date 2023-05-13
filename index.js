const express = require('express');
const redis = require('redis');
const responseTime = require('response-time');
const axios = require('axios');
require('dotenv').config();

const app = express();

const port = process.env.PORT || 3000;
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;
const redisUsername = process.env.REDIS_USERNAME;
const redisPassword = process.env.REDIS_PASSWORD;

const ihsHost = process.env.IHS_HOST;
const ihsNamespace = process.env.IHS_NAMESPACE;
const ihsUsername = process.env.IHS_USERNAME;
const ihsPassword = process.env.IHS_PASSWORD;

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
      data = JSON.parse(data);
      res.json({ status: 'success', fundname, data });
    } else {
        
      next();
    }
  });
};

const isAuthenticated = (req, res, next) => {
  client.get('ihs_apikey', (err, data) => {
    if (err) throw err;

    if (data !== null) {
      console.log(`API Key:Serving cache`)
      res.locals.apikey = data
      next();
    } else {
      console.log(`API Key: Reauthenticating and saving to cache`)
      ihs_authenticateUser(ihsHost, ihsUsername, ihsPassword)
      .then((results)=>{
        client.setEx(`ihs_apikey`, 3500, results);
        res.locals.apikey = results
        next();
      })
      .catch(err=>{
        res.status(400).json(err)
      })
    }
  });
};

async function ihs_authenticateUser(host, username, password) {
  const url = `${host}/apikey`;
  const params = { username, password };
  try {
    const response = await axios.post(url, {}, { params });
    return response.data;
  } catch (error) {
    throw {message: `IHS API Error: ${error.response.data.errorMessage}`}
  }
}

async function ihs_getlatestfund(host, namespace, apikey, fundTicker) {
  const url = `${host}/${namespace}/Fund/latest`;
  const params = { limit:1, format:'JSON', fundTicker, apikey: apikey};

  try {
    const response = await axios.get(url, { params });
    if(Array.isArray(response.data) && response.data.length > 0){
      return response.data[0];
    }
    else{

      return {}
    }
  } catch (error) {
    console.error(error)
    throw {message: `IHS API Error: ${error.response.data.errorMessage}`}
  }
}

const getFundData = async (fundname, apikey) => {
  console.log('Getting fund data')
  const data = await ihs_getlatestfund(ihsHost, ihsNamespace, apikey, fundname)
  if (data !== null) {
    console.log(`Setting Cache`)
    client.setEx(fundname, 2, JSON.stringify(data));
    return data;
  } else {
    return {};
  }
};

app.use(responseTime());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ status: 'Server running' });
});

app.get('/fund/:fundname', isCached, isAuthenticated, async (req, res) => {
  const fundname = req.params.fundname;
  try {
    const data = await getFundData(fundname, res.locals.apikey);
    res.json({ status: 'success', fundname, data });
  } catch (err) {
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
  console.log(`Redis Client Open: ${client.isOpen}`);
});