//全域常數
global.APP_ROOT_PATH = require('app-root-path');      //應用程式網站路徑
global.APP_ROOT_FOLDER = __dirname;      //應用程式實體資料夾位置

var https = require('https'),
    fs = require('fs'),
    express = require('express'),
    appConfig = require('./app-config'),
    weatherRoute = require('./routes/weather-route'),
    bodyParser = require('body-parser');

var app = express();

//SSL 憑證物件
var sslOptions = {
    key: fs.readFileSync(appConfig.SSL_AUTH_FILES.KEY),
    cert: fs.readFileSync(appConfig.SSL_AUTH_FILES.CERT),
    ca: fs.readFileSync(appConfig.SSL_AUTH_FILES.CA)
};

//使用 body-parser 將傳入 express 路由資料轉換為 json 物件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//掛載路由
app.use(weatherRoute);      //天氣速報事件路由

//啟動 HTTPS 伺服器
var server = https.createServer(sslOptions, app).listen(appConfig.HTTPS_SERVER_PORT);