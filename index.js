const express = require('express');
const NodeCache = require('node-cache');
const responseTime = require('response-time');
const axios = require('axios');
const cron = require('node-cron')
const moment = require('moment-timezone')
const cors = require('cors');
require('dotenv').config();

const app = express();

const cache = new NodeCache({ stdTTL: 60 * 5 }); // TTL of 5 minutes
const port = process.env.PORT || 3000;

const ihsHost = process.env.IHS_HOST;
const ihsNamespace = process.env.IHS_NAMESPACE;
const ihsUsername = process.env.IHS_USERNAME;
const ihsPassword = process.env.IHS_PASSWORD;

const validCodes = process.env.VALID_CODES.split(',')

// Generate and cache and API key on startup
// There will always be an API key in cache from startup
startup()

function startup(){
  ihs_authenticateUser(ihsHost, ihsUsername, ihsPassword)
  .then((results)=>{
    cache.set(`ihs_apikey`, results, 3500);
    console.log('STARTUP: API Key Cached')
    console.log('STARTUP: Creating scheduled tasks')

    for(let i = 0; i < validCodes.length;i++){
      console.log(`\tSCHEDULER: Adding scheduled job - Update Fund Data for ${validCodes[i]}`)
      cron.schedule('*/3 * * * * *', ()=>{
        try{
          const fundcode = validCodes[i]
          const cachedKey = cache.get('ihs_apikey')
    
          getFundData(fundcode,cachedKey)
            .then(results=>{
              cache.set(fundcode, results, 5);
              console.log(`SCHEDULER: Funds data for ${fundcode} refreshed`)
            })
            .catch(err=>{
              throw err
            })
        }
        catch (err){
          console.log(err)
        }
      })
    }
    console.log(`\tSCHEDULER: Adding scheduled job - Update API Key`)
    cron.schedule('*/55 * * * *', ()=>{
      try{
        ihs_authenticateUser(ihsHost, ihsUsername, ihsPassword)
          .then(results=>{
            cache.set(`ihs_apikey`, results, 3500);
            console.log('SCHEDULER: API Key Cached')
          })
          .catch(err=>{
            throw err
          })
      }
      catch (err){
        console.log(err)
      }
    })
  })
  .catch(err=>{
    console.log(err)
    process.exit()
  })
}

async function ihs_authenticateUser(host, username, password) {
  const url = `${host}/apikey`;
  const params = { username, password };
  try {
    const response = await axios.post(url, {}, { params });
    return response.data;
  } catch (error) {
    throw {message: `IHS API Error: ${error.response.data.errorMessage}`}
  }
};

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
};

const isAuthenticated = (req, res, next) => {
  const cachedKey = cache.get('ihs_apikey')

  if(cachedKey) {
    console.log('AUTH: API in cache')
    res.locals.apikey = cachedKey
    next()
  }
  else {
    console.log(`AUTH: API NOT in cache - Reauthenticating and saving to cache`)
    ihs_authenticateUser(ihsHost, ihsUsername, ihsPassword)
    .then((results)=>{
      cache.set(`ihs_apikey`, results, 3500);
      res.locals.apikey = results
      next();
    })
    .catch(err=>{
      res.status(400).json(err)
    })
  }
};

const isAllowed = (req, res, next) => {
  const fundname = req.params.fundname;

  if(!validCodes.includes(fundname)){
    res.status(404)
    res.json({ status: 'not found' });
  }
  else{
    next()
  }
};

const isCached = (req, res, next) => {
  const fundname = req.params.fundname;
  const cachedData = cache.get(fundname);

  if(cachedData != undefined){
    console.log(`WEB: Serving Cache`)

    let price = {currency: cachedData.currency, value: cachedData.values}
    let timeStamp = moment(cachedData.timeStamp).format('DD MMM yyyy, hh:mm:ss A')

    res.json({ provider: "IHS", fundTicker: fundname, ISIN: cachedData.fundSecurityId, price, timeStamp, status: 'success', message: ""});
  }
  else{
    next()
  }
};

const getFundData = async (fundname, apikey) => {
  const data = await ihs_getlatestfund(ihsHost, ihsNamespace, apikey, fundname)
  if (data !== null) {
    return data;
  } else {
    return {};
  }
};

app.use(responseTime());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(function (req, res, next) {
  res.header("Content-Type",'application/json');
  next();
});
// Enable CORS for the app
app.use(cors({
  origin: ['http://localhost', 'https://localhost', /^(https?:\/\/)?localhost(:\d+)?$/, /^(https?:\/\/)?([a-z0-9]+\.)*ondigitalocean\.app(:\d+)?$/i, /^(https?:\/\/)?([a-z0-9]+\.)*ferrer\.au(:\d+)?$/i]
}));

app.get('/', (req, res) => {
  res.json({ status: 'Server running' });
});

app.get('/fund/:fundname', isAllowed, isCached, isAuthenticated, async (req, res) => {

  const fundname = req.params.fundname;
  try {
    const data = await getFundData(fundname, res.locals.apikey);
    console.log(`CACHE: Setting Cache`)
    cache.set(fundname, data, 3);


    let price = {currency: data.currency, value: data.values}
    let timeStamp = moment(data.timeStamp).format('DD MMM yyyy, hh:mm:ss A')

    res.json({ provider: "IHS", fundTicker: fundname, ISIN: data.fundSecurityId, price, timeStamp, status: 'success', message: ""});
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
});