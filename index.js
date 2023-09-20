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

const solactiveHost = process.env.SOLACTIVE_HOST
const solactiveUsername = process.env.SOLACTIVE_USERNAME;
const solactivePassword = process.env.SOLACTIVE_PASSWORD;

const ihsvalidCodes = process.env.VALID_CODES.split(',')
const solactivevalidCodes = process.env.SOLACTIVE_ISINS.split(',')

// Generate and cache and API key on startup
// There will always be an API key in cache from startup
startup()

function startup(){
  // Startup Call fo IHS
  ihs_authenticateUser(ihsHost, ihsUsername, ihsPassword)
  .then((results)=>{
    cache.set(`ihs_apikey`, results, 3500);
    console.log('STARTUP: IHS API Key Cached')
    console.log('STARTUP: Creating IHS scheduled tasks')

    for(let i = 0; i < ihsvalidCodes.length;i++){
      console.log(`\tSCHEDULER: Adding IHS scheduled job - Update Fund Data for ${ihsvalidCodes[i]}`)
      cron.schedule('*/1 * * * * *', ()=>{
        try{
          const fundcode = ihsvalidCodes[i]
          const cachedKey = cache.get('ihs_apikey')
    
          ihs_getFundData(fundcode,cachedKey)
            .then(results=>{
              cache.set(fundcode, results, 2);
              console.log(`SCHEDULER: Funds data from IHS for ${fundcode} refreshed`)
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
    console.log(`\tSCHEDULER: Adding IHS scheduled job - Update API Key`)
    cron.schedule('*/55 * * * *', ()=>{
      try{
        ihs_authenticateUser(ihsHost, ihsUsername, ihsPassword)
          .then(results=>{
            cache.set(`ihs_apikey`, results, 3500);
            console.log('SCHEDULER: IHS API Key Cached')
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

  // Startup Calls for Solactive
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

const ihs_isAuthenticated = (req, res, next) => {
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

const ihs_isAllowed = (req, res, next) => {
  const fundname = req.params.fundname;

  if(!ihsvalidCodes.includes(fundname)){
    res.status(404)
    res.json({ status: 'not found' });
  }
  else{
    next()
  }
};

const ihs_isCached = (req, res, next) => {
  const fundname = req.params.fundname;
  const cachedData = cache.get(fundname);

  if(cachedData != undefined){
    console.log(`WEB: Serving Cache`)

    let price = {currency: cachedData.currency, value: cachedData.values}
    let timeStamp = moment(cachedData.timeStamp)
    res.json({ provider: "IHS", fundTicker: fundname, ISIN: cachedData.fundSecurityId, price, timeStamp, status: 'success', message: ""});
  }
  else{
    next()
  }
};

const ihs_getFundData = async (fundname, apikey) => {
  const data = await ihs_getlatestfund(ihsHost, ihsNamespace, apikey, fundname)
  if (data !== null) {
    return data;
  } else {
    return {};
  }
};

async function solactive_getlatestfund(host, fundTicker, username) {
  const url = `${host}/api/rest/v1/indices/${username}/${fundTicker}/history`;
  const params = {
    auth: {
      username: `${solactiveUsername}`,
      password: `${solactivePassword}`
    }
  };

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
    throw {message: `Solactive API Error: ${error.response.data.errorMessage}`}
  }
};

const solactive_getFundData = async (fundname, username) => {
  const data = await solactive_getlatestfund(solactiveHost, fundname, username)
  if (data !== null) {
    return data;
  } else {
    return {};
  }
};

const solactive_isAllowed = (req, res, next) => {
  const fundname = req.params.fundname;

  if(!solactivevalidCodes.includes(fundname)){
    res.status(404)
    res.json({ status: 'not found' });
  }
  else{
    next()
  }
};

const solactive_isCached = (req, res, next) => {
  const fundname = req.params.fundname;
  const cachedData = cache.get(fundname);

  if(cachedData != undefined){
    console.log(`WEB: Serving Cache`)

    let price = {currency: cachedData.currency, value: cachedData.values}
    let timeStamp = moment(cachedData.timeStamp)
    res.json({ provider: "Solactive", fundTicker: fundname, ISIN: cachedData.fundSecurityId, price, timeStamp, status: 'success', message: ""});
  }
  else{
    next()
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
  origin: ['http://localhost', 'https://localhost', /^(https?:\/\/)?localhost(:\d+)?$/, /^(https?:\/\/)?([a-z0-9]+\.)*ondigitalocean\.app$/i, /^(https?:\/\/(?:.+\.)?ferrer\.au(?::\d{1,5})?)$/i, /^(https?:\/\/)?([a-z0-9]+\.)*ferrer\.au$/i]
}));

app.get('/', (req, res) => {
  res.json({ status: 'Server running' });
});

// Router for IHS data
// Forwards the previous route to the new route
app.get('/fund/:fundname', async (req, res, next) => {
  req.fundname = req.params.fundname
  res.redirect(`/ihs/fund/${req.params.fundname}`)
});
// New route that has the provider name in the path.
app.get('/ihs/fund/:fundname', ihs_isAllowed, ihs_isCached, ihs_isAuthenticated, async (req, res) => {

  const fundname = (req.fundname.length > 0 ? req.fundname : req.params.fundname);
  try {
    const data = await solactive_getFundData(fundname, res.locals.apikey);
    console.log(`CACHE: Setting Cache`)
    cache.set(fundname, data, 2);


    let price = {currency: data.currency, value: data.values}
    let timeStamp = moment(cachedData.timeStamp)

    res.json({ provider: "IHS", fundTicker: fundname, ISIN: data.fundSecurityId, price, timeStamp, status: 'success', message: ""});
  } catch (err) {
    res.json({ status: 'error', message: err.message });
  }
});

// Router for Solactive data
app.get('/solactive/fund/:fundname', solactive_isAllowed, solactive_isCached, async (req, res) => {

  const fundname = req.params.fundname;
  try {
    const data = await ihs_getFundData(fundname, res.locals.apikey);
    console.log(`CACHE: Setting Cache`)
    cache.set(fundname, data, 2);


    let price = {currency: data.currency, value: data.values}
    let timeStamp = moment(cachedData.timeStamp)

    res.json({ provider: "Solactive", fundTicker: fundname, ISIN: data.fundSecurityId, price, timeStamp, status: 'success', message: ""});
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