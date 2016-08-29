//modules
var appConfig = require(global.APP_ROOT_PATH + '/app-config'),
    fileHandler = require(global.APP_ROOT_PATH + '/lib/public/file-handler'),
    generalTools = require(global.APP_ROOT_PATH + '/lib/public/general-tools'),
    projectTools = require(global.APP_ROOT_PATH + '/lib/project/project-tools'),
    router = require('express').Router(),
    async = require('async'),
    sql = require('mssql'),
    moment = require('moment'),
    util = require('util');

//連線 MS SQL SERVER 模組物件
var mssqlTools = new (require(global.APP_ROOT_PATH + '/lib/public/mssql-tools'))(
    appConfig.MSSQL_CONNECTION_INFO.SERVER,
    appConfig.MSSQL_CONNECTION_INFO.PORT,
    appConfig.MSSQL_CONNECTION_INFO.DATABASE,
    appConfig.MSSQL_CONNECTION_INFO.USER,
    appConfig.MSSQL_CONNECTION_INFO.PASSWORD
);

//電子郵件發送模組物件
var emailModule = new (require(global.APP_ROOT_PATH + '/lib/public/email-module'))(
    appConfig.EMAIL_SERVER_INFO.SMTP,
    appConfig.EMAIL_SERVER_INFO.PORT,
    appConfig.EMAIL_SERVER_INFO.SECURE,
    appConfig.EMAIL_SERVER_INFO.USER,
    appConfig.EMAIL_SERVER_INFO.PASS
);

//天氣速報定義常數值
var CHANNEL = 'WEATHER',        //天氣速報頻道名稱
    LINE_TEXT_PARAM_START = 'EBCCWB',       //天氣速報 LINE 官方帳號操作指令開頭關鍵字
    WEATHER_EVENT_DESC_ENUM = { 0: '天氣速報', 1: '地震速報', 2: '雷雨速報' }       //天氣速報代碼與描述文字對應表

//天氣速報事件紀錄與電子郵件資料來源模型
var logDataSourceModel = {
    log_type_code: null,        //事件紀錄類型代碼(1：處理程序、2：錯誤事件)
    weather_event_code: null,       //推播天氣類型代碼(0：全部、1：地震速報、2：雷雨速報)
    log_title: null,        //log 紀錄主題
    description: null,      //log 紀錄描述文字
    create_user: null,      //資料建立者
    line_mid: null,     //推播用戶 Line 唯一識別碼(非必要)
    ebc_acn: null       //推播用戶帳號(非必要)
};

//接收 Line 傳入天氣速報官方帳號的介接 api
router.post('/weather/line-callback', function (req, res) {
    var resultAry = req.body.result;

    for (var result in resultAry) {
        var resultObj = resultAry[result];      //訊息資料物件
        var eventType = resultObj.eventType;       //訊息事件類型

        switch (eventType) {
            case appConfig.LINE_FIXED_INFO.RECEIVE_ACTION_EVENT_TYPE:       //(固定)接收操作指令 (如加好友)
                break;
            case appConfig.LINE_FIXED_INFO.RECEIVE_MSG_EVENT_TYPE:      //(固定)接收訊息 (如訊息或照片)
                var contentType = resultObj.content.contentType;

                //檢查傳入的是否為文字訊息代號
                if (contentType === 1) {
                    var inputParamAry = resultObj.content.text.split(' ');
                    if (inputParamAry.length === 3) {
                        if (inputParamAry[0].toUpperCase() === LINE_TEXT_PARAM_START) {
                            var lineMid = resultObj.content.from;       //Line 用戶唯一識別碼
                            var ebcAcn = inputParamAry[1];      //帳號
                            var weatherEventCode = 0;       //新增推播用戶，要接收的天氣速報類型暫不分類，統一使用 0 (全部天氣速報類型)

                            switch (inputParamAry[2].toUpperCase()) {
                                case 'ADD':     //用戶輸入新增天氣速報推播指令
                                    async.waterfall([
                                        function (callback) {
                                            checkWeatherPushExistOrAdd(weatherEventCode, lineMid, ebcAcn, function (err, procResultJson) {
                                                callback(err, procResultJson);
                                            });
                                        },
                                        function (procResultJson, callback) {
                                            projectTools.pushLineTextMessage(
                                                [lineMid],
                                                procResultJson.result_message,
                                                appConfig.LINE_CHANNEL_REQUEST_HEADERS[CHANNEL],
                                                function (err, httpResponse) {
                                                    callback(err, httpResponse, procResultJson.result_code);
                                                }
                                            );
                                        }
                                    ], function (err, httpResponse, addResultCode) {       //(錯誤訊息, http 回應物件, 新增推播用戶結果代碼)
                                        var model = generalTools.cloneJsonObject(logDataSourceModel);

                                        //LINE 推播結果須解析 httpResponse 物件得知
                                        if (err || (httpResponse.hasOwnProperty('statusCode') && httpResponse.statusCode !== 200)) {
                                            model.log_title = '【新增】天氣速報推播用戶程序發生無法預期的錯誤';
                                            model.log_type_code = 2;
                                            model.weather_event_code = weatherEventCode;
                                            model.description = ((err) ? JSON.stringify(err) : JSON.stringify(httpResponse.body));
                                            model.create_user = appConfig.SYSTEM_ADMIN_ACCOUNT;
                                            model.line_mid = lineMid;
                                            model.ebc_acn = ebcAcn;

                                            //寫入資料庫 log 紀錄與寄送電子郵件
                                            writeLogWithSendMail(model, true, true);
                                        } else {

                                            //只有用戶可正確加入天氣速報名單時，才需對其他用戶進行推播
                                            if (addResultCode === 1) {
                                                var pushMessage = util.format('%s 【加入】天氣速報推播名單', ebcAcn);
                                                pushMessageWithoutSelf(weatherEventCode, lineMid, pushMessage, function (err, httpResponse) {

                                                    //LINE 推播結果須解析 lineResponse 物件得知
                                                    if (err || (httpResponse.hasOwnProperty('statusCode') && httpResponse.statusCode !== 200)) {
                                                        model.log_title = '系統在推播用戶申請【加入】至天氣速報名單時發生無法預期的錯誤';
                                                        model.log_type_code = 2;
                                                        model.weather_event_code = weatherEventCode;
                                                        model.description = ((err) ? JSON.stringify(err) : JSON.stringify(httpResponse.body));
                                                        model.create_user = appConfig.SYSTEM_ADMIN_ACCOUNT;
                                                        model.line_mid = lineMid;
                                                        model.ebc_acn = ebcAcn;

                                                        //寫入資料庫 log 紀錄與寄送電子郵件
                                                        writeLogWithSendMail(model, true, true);
                                                    }
                                                });
                                            }
                                        }
                                    });

                                    break;
                                case 'DEL':     //用戶輸入刪除天氣速報推播指令
                                    async.waterfall([
                                        function (callback) {
                                            deleteWeatherPushUser(weatherEventCode, lineMid, ebcAcn, function (err, procResultJson) {
                                                callback(err, procResultJson);
                                            });
                                        },
                                        function (procResultJson, callback) {
                                            projectTools.pushLineTextMessage(
                                                [lineMid],
                                                procResultJson.result_message,
                                                appConfig.LINE_CHANNEL_REQUEST_HEADERS[CHANNEL],
                                                function (err, httpResponse) {
                                                    callback(err, httpResponse, procResultJson.result_code);
                                                }
                                            );
                                        }
                                    ], function (err, httpResponse, delResultCode) {       //(錯誤訊息, http 回應物件, 刪除推播用戶結果代碼)
                                        var model = generalTools.cloneJsonObject(logDataSourceModel);

                                        //LINE 推播結果須解析 httpResponse 物件得知
                                        if (err || (httpResponse.hasOwnProperty('statusCode') && httpResponse.statusCode !== 200)) {
                                            model.log_title = '【刪除】天氣速報推播用戶程序發生無法預期的錯誤';
                                            model.log_type_code = 2;
                                            model.weather_event_code = weatherEventCode;
                                            model.description = ((err) ? JSON.stringify(err) : JSON.stringify(httpResponse.body));
                                            model.create_user = appConfig.SYSTEM_ADMIN_ACCOUNT;
                                            model.line_mid = lineMid;
                                            model.ebc_acn = ebcAcn;

                                            //寫入資料庫 log 紀錄與寄送電子郵件
                                            writeLogWithSendMail(model, true, true);
                                        } else {

                                            //只有用戶可正確加入天氣速報名單時，才需對其他用戶進行推播
                                            if (delResultCode > 0) {
                                                var pushMessage = util.format('%s 【退出】天氣速報推播名單', ebcAcn);
                                                pushMessageWithoutSelf(weatherEventCode, lineMid, pushMessage, function (err, httpResponse) {

                                                    //LINE 推播結果須解析 lineResponse 物件得知
                                                    if (err || (httpResponse.hasOwnProperty('statusCode') && httpResponse.statusCode !== 200)) {
                                                        model.log_title = '系統在推播用戶申請【退出】天氣速報名單時發生無法預期的錯誤';
                                                        model.log_type_code = 2;
                                                        model.weather_event_code = weatherEventCode;
                                                        model.description = ((err) ? JSON.stringify(err) : JSON.stringify(httpResponse.body));
                                                        model.create_user = appConfig.SYSTEM_ADMIN_ACCOUNT;
                                                        model.line_mid = lineMid;
                                                        model.ebc_acn = ebcAcn;

                                                        //寫入資料庫 log 紀錄與寄送電子郵件
                                                        writeLogWithSendMail(model, true, true);
                                                    }
                                                });
                                            }
                                        }
                                    });

                                    break;
                            }
                        }
                    }
                }

                break;
        }
    }

    //回應訊息給 Line 官方，測試 callBack 網址時可用
    res.send('1');
});

/**
 * 接收天氣速報即時訊息介接 API
*/
router.post('/weather/push-message', function (request, response) {
    var weatherEventCode = request.body.weather_event_code;
    var pushMessage = request.body.push_message;
    var responseJson = {
        result_code: null,
        result_message: ''
    }

    if (WEATHER_EVENT_DESC_ENUM[weatherEventCode] && pushMessage) {
        //weatherEventCode = 0;       //目前預設加入天氣速報推播的類型為全部(0： 全部、1： 地震速報、2： 雷雨速報)

        async.waterfall([
            function (callback) {

                //接收到新的天氣速報即時訊息，寫入資料庫 log 紀錄
                var model = generalTools.cloneJsonObject(logDataSourceModel);
                model.log_type_code = 1;
                model.weather_event_code = weatherEventCode;
                model.log_title = '天氣速報 Line 訊息推播 API 接收到新的即時訊息';
                model.description = pushMessage;
                model.create_user = appConfig.SYSTEM_ADMIN_ACCOUNT;

                //寫入資料庫 log 紀錄
                writeLogWithSendMail(model, true, false, function (err, result) {
                    callback(err);
                });
            },

            //取得要推播的名單
            function (callback) {

                //目前預設要取得的天氣速報推播對象為全部天氣類型(0： 全部、1： 地震速報、2： 雷雨速報)
                var sqlComm = ' SELECT DISTINCT [LINE_MID] FROM [dbo].[WEATHER_PUSH_LIST]\
                                WHERE ([WEATHER_EVENT_CODE] = @WEATHER_EVENT_CODE OR [WEATHER_EVENT_CODE] >= 0)\
                                AND [DFLAG] = 0 ';

                //程序傳入參數
                var inputParamJson = {
                    WEATHER_EVENT_CODE: {
                        type: sql.Int,
                        value: weatherEventCode
                    }
                };

                mssqlTools.execQuery(sqlComm, inputParamJson, function (err, recordSet) {
                    callback(err, recordSet);
                });
            },

            //發送 LINE 訊息至推播用戶名單
            function (recordSet, callback) {
                if (recordSet.length > 0) {
                    var midAry = [];

                    recordSet.forEach(function (record, idx) {
                        midAry.push(record.LINE_MID);
                    });

                    projectTools.pushLineTextMessage(
                        midAry,
                        pushMessage,
                        appConfig.LINE_CHANNEL_REQUEST_HEADERS[CHANNEL],
                        function (err, result) {
                            callback(err, result);
                        }
                    );
                } else {        //無推播用戶名單
                    callback('無可推播的天氣速報 Line 訊息推播成員', null);
                }
            }
        ], function (err, httpResponse) {

            // log 紀錄 model
            var model = generalTools.cloneJsonObject(logDataSourceModel);
            model.weather_event_code = weatherEventCode;
            model.create_user = appConfig.SYSTEM_ADMIN_ACCOUNT;

            //LINE 推播結果須解析 res.body 物件得知
            if (err || (httpResponse.hasOwnProperty('statusCode') && httpResponse.statusCode !== 200)) {     //推播資料發送至 Line 伺服器發生網路錯誤或 Line 伺服器回應操作錯誤
                var errMessage = ((err) ? JSON.stringify(err) : JSON.stringify(httpResponse.body));
                model.log_type_code = 2;
                model.log_title = '天氣速報 Line 訊息推播 API 發生無法預期的錯誤';
                model.description = errMessage;

                //API 回應資訊
                responseJson.result_code = ((err) ? -1 : -2);       //-1： 網路發生錯誤、-2： Line 回應操作錯誤
                responseJson.result_message = errMessage;
            } else {        //推播資料發送至 Line 伺服器回應成功
                model.log_type_code = 1;
                model.log_title = '天氣速報 Line 訊息推播 API 發送成功';
                model.description = pushMessage;

                //API 回應資訊
                responseJson.result_code = 1;
            }

            //寫入資料庫 log 紀錄
            writeLogWithSendMail(model, true, false, function (err, result) {
                if (err) {      //寫入資料庫 log 紀錄時發生錯誤，輸出到 forever log
                    console.log(util.format('天氣速報 Line 訊息推播 API，在寫入資料庫 log 紀錄時，發生無法預期的錯誤 (event： %s，error： %s)', model.log_title, err));
                }
            });

            response.json(responseJson);
        });
    } else {
        responseJson.result_code = 0;
        responseJson.result_message = util.format('無效的傳入參數 (weatherEventCode： %s，pushMessage： %s)', weatherEventCode, pushMessage);
        response.json(responseJson);
    }
});

/**
 * 接收天氣速報即時訊息介接 API(測試用)
*/
router.post('/weather/push-message-test', function (request, response) {
    var weatherEventCode = request.body.weather_event_code;
    var pushMessage = request.body.push_message;
    var responseJson = {
        result_code: null,
        result_message: ''
    }

    if (WEATHER_EVENT_DESC_ENUM[weatherEventCode] && pushMessage) {
        //weatherEventCode = 0;       //目前預設加入天氣速報推播的類型為全部(0： 全部、1： 地震速報、2： 雷雨速報)
        pushMessage = appConfig.TEST_LINE_PUSH_MESSAGE_PREFIX[CHANNEL] + pushMessage;

        async.waterfall([
            function (callback) {

                //接收到新的天氣速報即時訊息，寫入資料庫 log 紀錄
                var model = generalTools.cloneJsonObject(logDataSourceModel);
                model.log_type_code = 1;
                model.weather_event_code = weatherEventCode;
                model.log_title = appConfig.TEST_LINE_PUSH_MESSAGE_PREFIX[CHANNEL] + '天氣速報 Line 訊息推播 API 接收到新的即時訊息';
                model.description = pushMessage;
                model.create_user = appConfig.SYSTEM_ADMIN_ACCOUNT;

                //寫入資料庫 log 紀錄
                writeLogWithSendMail(model, true, false, function (err, result) {
                    callback(err);
                });
            },

            //取得要推播的名單
            function (callback) {

                //目前預設要取得的天氣速報推播對象為全部天氣類型(0： 全部、1： 地震速報、2： 雷雨速報)
                var sqlComm = ' SELECT DISTINCT [LINE_MID] FROM [dbo].[WEATHER_PUSH_LIST]\
                                WHERE ([WEATHER_EVENT_CODE] = @WEATHER_EVENT_CODE OR [WEATHER_EVENT_CODE] >= 0)\
                                AND [DFLAG] = 0 ';

                //程序傳入參數
                var inputParamJson = {
                    WEATHER_EVENT_CODE: {
                        type: sql.Int,
                        value: weatherEventCode
                    }
                };

                mssqlTools.execQuery(sqlComm, inputParamJson, function (err, recordSet) {
                    callback(err, recordSet);
                });
            },

            //發送 LINE 訊息至推播用戶名單
            function (recordSet, callback) {
                if (recordSet.length > 0) {
                    var midAry = [];

                    recordSet.forEach(function (record, idx) {
                        midAry.push(record.LINE_MID);
                    });

                    projectTools.pushLineTextMessage(
                        midAry,
                        pushMessage,
                        appConfig.LINE_CHANNEL_REQUEST_HEADERS[CHANNEL],
                        function (err, result) {
                            callback(err, result);
                        }
                    );
                } else {        //無推播用戶名單
                    callback(appConfig.TEST_LINE_PUSH_MESSAGE_PREFIX[CHANNEL] + '無可推播的天氣速報 Line 訊息推播成員', null);
                }
            }
        ], function (err, httpResponse) {

            // log 紀錄 model
            var model = generalTools.cloneJsonObject(logDataSourceModel);
            model.weather_event_code = weatherEventCode;
            model.create_user = appConfig.SYSTEM_ADMIN_ACCOUNT;

            //LINE 推播結果須解析 res.body 物件得知
            if (err || (httpResponse.hasOwnProperty('statusCode') && httpResponse.statusCode !== 200)) {     //推播資料發送至 Line 伺服器發生網路錯誤或 Line 伺服器回應操作錯誤
                var errMessage = appConfig.TEST_LINE_PUSH_MESSAGE_PREFIX[CHANNEL] + ((err) ? JSON.stringify(err) : JSON.stringify(httpResponse.body));
                model.log_type_code = 2;
                model.log_title = appConfig.TEST_LINE_PUSH_MESSAGE_PREFIX[CHANNEL] + '天氣速報 Line 訊息推播 API 發生無法預期的錯誤';
                model.description = errMessage;

                //API 回應資訊
                responseJson.result_code = ((err) ? -1 : -2);       //-1： 網路發生錯誤、-2： Line 回應操作錯誤
                responseJson.result_message = errMessage;
            } else {        //推播資料發送至 Line 伺服器回應成功
                model.log_type_code = 1;
                model.log_title = appConfig.TEST_LINE_PUSH_MESSAGE_PREFIX[CHANNEL] + '天氣速報 Line 訊息推播 API 發送成功';
                model.description = pushMessage;

                //API 回應資訊
                responseJson.result_code = 1;
            }

            //寫入資料庫 log 紀錄
            writeLogWithSendMail(model, true, false, function (err, result) {
                if (err) {      //寫入資料庫 log 紀錄時發生錯誤，輸出到 forever log
                    console.log(util.format('天氣速報 Line 訊息推播 API，在寫入資料庫 log 紀錄時，發生無法預期的錯誤 (event： %s，error： %s)', model.log_title, err));
                }
            });

            response.json(responseJson);
        });
    } else {
        responseJson.result_code = 0;
        responseJson.result_message = util.format('無效的傳入參數 (weatherEventCode： %s，pushMessage： %s)', weatherEventCode, pushMessage);
        response.json(responseJson);
    }
});

/**
 * 推播訊息至天氣速報推播名單，並排除目前的 Line 使用者唯一識別碼
 *
 * weatherEventCode： 天氣速報推播的類型代碼(0： 全部、1： 地震速報、2： 雷雨速報)
 * lineMid： Line 用戶唯一識別碼
 * message： 要推播的訊息
 * callback： 回應函式
 */
function pushMessageWithoutSelf(weatherEventCode, lineMid, message, callback) {
    async.waterfall([
        function (callback) {
            var sqlComm = " SELECT DISTINCT [LINE_MID] FROM [dbo].[WEATHER_PUSH_LIST] WHERE [WEATHER_EVENT_CODE] = @WEATHER_EVENT_CODE\
                            AND [DFLAG] = 0 AND [LINE_MID] <> @LINE_MID ";

            //傳入預存程序參數
            var inputParamJson = {
                WEATHER_EVENT_CODE: {
                    type: sql.Int,
                    value: weatherEventCode
                },
                LINE_MID: {
                    type: sql.VarChar(50),
                    value: lineMid
                }
            };

            mssqlTools.execQuery(sqlComm, inputParamJson, function (err, recordSet) {
                callback(err, recordSet);
            });
        },
        function (recordSet, callback) {
            if (recordSet.length > 0) {
                var midAry = [];

                recordSet.forEach(function (record, idx) {
                    midAry.push(record.LINE_MID);
                });

                projectTools.pushLineTextMessage(
                    midAry,
                    message,
                    appConfig.LINE_CHANNEL_REQUEST_HEADERS[CHANNEL],
                    function (err, lineResponse) {
                        callback(err, lineResponse);
                    }
                );
            } else {        //無推播用戶名單
                callback('無可推播的天氣速報 Line 訊息推播成員', null);
            }
        }
    ], function (err, result) {
        callback(err, result);
    });
}

/**
 * 檢查天氣速報推播用戶是否已經存在於天氣速報推播名單中，若無則加入
 *
 * weatherEventCode： 天氣速報推播的類型代碼(0： 全部、1： 地震速報、2： 雷雨速報)
 * lineMid： Line 用戶唯一識別碼
 * ebcAcn： 帳號
 * callback： 回應函式
 */
function checkWeatherPushExistOrAdd(weatherEventCode, lineMid, ebcAcn, callback) {

    //傳入預存程序參數
    var inputParamJson = {
        weather_event_code: {
            type: sql.Int,
            value: weatherEventCode
        },
        line_mid: {
            type: sql.VarChar(50),
            value: lineMid
        },
        ebc_acn: {
            type: sql.VarChar(50),
            value: ebcAcn
        },
        create_user: {
            type: sql.VarChar(50),
            value: appConfig.SYSTEM_ADMIN_ACCOUNT
        }
    };

    //預存程序輸出參數
    var outputParamJson = {
        return_value: {
            type: sql.Int
        },
        return_message: {
            type: sql.NVarChar(200)
        }
    };

    //執行預存程序
    mssqlTools.execStoredProcedure('[dbo].[USP_checkWeatherPushExistOrAdd]',
        inputParamJson,
        outputParamJson,
        function (err, recordSet, parameters) {

            //處理結果 json 物件
            var procResultJson = {
                result_code: null,
                result_message: null
            }

            if (!err) {
                var errorMessage = null;
                procResultJson.result_code = parameters.return_value.value;        //取得回應結果代碼

                switch (procResultJson.result_code) {
                    case 0:
                        procResultJson.result_message = '操作成功！您於之前已加入天氣速報推播名單';
                        break;
                    case 1:
                        procResultJson.result_message = '操作成功！已將您新增至天氣速報推播名單';
                        break;
                    case -1:
                        procResultJson.result_message = '操作失敗！您於之前已申請退出天氣速報推播名單，如有疑問請聯絡管理員';
                        break;
                    case -2:
                        procResultJson.result_message = '操作失敗！系統欲將您新增至天氣速報推播名單時，發生無法預期的錯誤，如有疑問請聯絡管理員';
                        errorMessage = parameters.return_message.value;
                        break;
                }

                callback(errorMessage, procResultJson);
            } else {
                callback(err, procResultJson);
            }
        }
    );
};

/**
 * 刪除天氣速報推播用戶
 *
 * weatherEventCode： 天氣速報推播的類型代碼(0： 全部、1： 地震速報、2： 雷雨速報)
 * lineMid： Line 用戶唯一識別碼
 * ebcAcn： 帳號
 * callback： 回應函式
 */
function deleteWeatherPushUser(weatherEventCode, lineMid, ebcAcn, callback) {
    var sqlComm = ' UPDATE [dbo].[WEATHER_PUSH_LIST] SET [DFLAG] = 1, [UPDATE_DATE] = GETDATE(), [UPDATE_USER] = @UPDATE_USER\
                    WHERE [WEATHER_EVENT_CODE] = @WEATHER_EVENT_CODE AND [LINE_MID] = @LINE_MID AND [EBC_ACN] = @EBC_ACN\
                    AND [DFLAG] = 0 ';

    //程序傳入參數
    var inputParamJson = {
        WEATHER_EVENT_CODE: {
            type: sql.Int,
            value: weatherEventCode
        },
        LINE_MID: {
            type: sql.VarChar(50),
            value: lineMid
        },
        EBC_ACN: {
            type: sql.VarChar(50),
            value: ebcAcn
        },
        UPDATE_USER: {
            type: sql.VarChar(50),
            value: appConfig.SYSTEM_ADMIN_ACCOUNT
        }
    };

    mssqlTools.execModify(sqlComm, inputParamJson, function (err, modifyCount) {

        //處理結果 json 物件
        var procResultJson = {
            result_code: null,
            result_message: null
        }

        if (!err) {
            procResultJson.result_code = modifyCount;        //取得異動結果筆數

            if (procResultJson.result_code > 0) {
                procResultJson.result_message = '操作成功！已將您從天氣速報推播名單中移除';
            } else {
                procResultJson.result_message = '操作失敗！您輸入的資料並不屬於天氣速報推播名單中的成員';
            }

            callback(null, procResultJson);
        } else {
            callback(err, procResultJson);
        }

    });
};

/**
 * 寫入天氣速報事件紀錄
 *
 * weatherLogInfo： 天氣速報事件紀錄 json 物件
 * callback： 回應函式
 */
function writingWeatherEventLogs(weatherLogInfo, callback) {
    var sqlComm;

    //程序傳入參數
    var inputParamJson = {
        LOG_TYPE_CODE: {
            type: sql.Int,
            value: weatherLogInfo.log_type_code      //事件紀錄類型代碼(1：處理程序、2：錯誤事件)
        },
        WEATHER_EVENT_CODE: {
            type: sql.Int,
            value: weatherLogInfo.weather_event_code      //0： 全部、1： 地震速報、2： 雷雨速報
        },
        TITLE: {
            type: sql.NVarChar(500),
            value: weatherLogInfo.log_title
        },
        DESCRIPTION: {
            type: sql.NVarChar(sql.MAX),
            value: weatherLogInfo.description
        },
        CREATE_USER: {
            type: sql.VarChar(50),
            value: weatherLogInfo.create_user
        }
    };

    if (weatherLogInfo.line_mid && weatherLogInfo.ebc_acn) {
        sqlComm = ' INSERT INTO [dbo].[WEATHER_LOGS] ([LOG_TYPE_CODE], [WEATHER_EVENT_CODE], [LINE_MID],[EBC_ACN],\
                    [TITLE], [DESCRIPTION], [CREATE_DATE], [CREATE_USER])\
                    SELECT @LOG_TYPE_CODE, @WEATHER_EVENT_CODE, @LINE_MID, @EBC_ACN, @TITLE, @DESCRIPTION, GETDATE(), @CREATE_USER ';

        inputParamJson.LINE_MID = {
            type: sql.VarChar(50),
            value: weatherLogInfo.line_mid
        }

        inputParamJson.EBC_ACN = {
            type: sql.VarChar(50),
            value: weatherLogInfo.ebc_acn
        }

    } else {
        sqlComm = ' INSERT INTO [dbo].[WEATHER_LOGS] ([LOG_TYPE_CODE], [WEATHER_EVENT_CODE], [TITLE],\
                    [DESCRIPTION], [CREATE_DATE], [CREATE_USER])\
                    SELECT @LOG_TYPE_CODE, @WEATHER_EVENT_CODE, @TITLE, @DESCRIPTION, GETDATE(), @CREATE_USER ';
    }

    mssqlTools.execModify(sqlComm, inputParamJson, function (err, modifyCount) {
        if (callback) {
            callback(err, modifyCount);
        }
    });
};

/**
 * 設定電子郵件內容並發送
 *
 * mailInfo： 電子郵件內容資訊
 * callback： 回應函式
 */
function sendEmailContent(mailInfo, callback) {

    //電子郵件內容
    var mailContent = util.format('主機： %s\r\n類型： %s\r\n描述： %s\r\nLine 用戶識別碼： %s\r\n帳號： %s\r\n時間： %s',
        generalTools.getHostIps('ipv4').ipv4[0],
        WEATHER_EVENT_DESC_ENUM[mailInfo.weather_event_code] || '',
        mailInfo.description,
        mailInfo.line_mid,
        mailInfo.ebc_acn,
        moment().format('YYYY-MM-DD HH:mm:ss')
    );

    emailModule.sendMail(
        appConfig.EMAIL_CHANNEL_SENDER_RECEIVERS[CHANNEL].SENDER,
        appConfig.EMAIL_CHANNEL_SENDER_RECEIVERS[CHANNEL].RECEIVERS,
        mailInfo.log_title,
        mailContent,
        null,
        function (err, info) {
            if (callback) {
                callback(err, info);
            }
        }
    );
};

/**
 * 寫入資料庫天氣速報事件紀錄與寄送電子郵件
 *
 * model： 天氣速報事件紀錄與電子郵件資料模型
 * isWriteDbLog： 是否寫入資料庫 log 紀錄
 * isSendEmail： 是否寄送電子郵件
 * callback： 回應函式
 */
function writeLogWithSendMail(model, isWriteDbLog, isSendEmail, callback) {

    //寫入資料庫 log 紀錄
    if (isWriteDbLog) {
        writingWeatherEventLogs(model, function (err, modifyCount) {
            if (err) {      //寫入資料庫 log 紀錄時發生錯誤，輸出到 forever log
                console.log(util.format('天氣速報 Line 訊息推播程式，在寫入資料庫 log 紀錄時，發生無法預期的錯誤 (event： %s，error： %s)', model.log_title, err));
            }

            if (callback) {
                callback(err, modifyCount);
            }
        });
    }

    //寄發電子郵件通知
    if (isSendEmail) {
        sendEmailContent(mailInfo, function (err, info) {
            if (err) {      //寄發郵件時發生錯誤，輸出到 forever log
                console.log(util.format('天氣速報 Line 訊息推播程式，在發送電子郵件通知時，發生無法預期的錯誤 (event： %s，error： %s)', model.log_title, err));
            }

            if (callback) {
                callback(err, info);
            }
        });
    }
};

module.exports = router;


