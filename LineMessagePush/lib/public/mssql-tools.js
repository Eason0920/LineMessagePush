/**
 * @description Node.js 存取 MS SQL Server 版本建立
 * @author Eason
 * @since 20160810
 * @version 1
 */

var sql = require('mssql');
var dbConfig = {
    server: null,
    port: 1433,
    database: null,
    user: null,
    password: null
};

/**
 * 模組建構子
 *
 * server： 伺服器
 * database： 資料庫名稱
 * user： 登入帳號
 * password： 登入密碼
 */
function mssqlTools(server, port, database, user, password) {
    dbConfig.server = server;
    dbConfig.port = port;
    dbConfig.database = database;
    dbConfig.user = user;
    dbConfig.password = password;
}

/**
 * 執行資料庫查詢
 *
 * sqlComm： SQL Query Command
 * paramsJson： preparedSql 參數
 * callback： 回應函式
 */
mssqlTools.prototype.execQuery = function (sqlComm, inputParamJson, callback) {
    sql.connect(dbConfig).then(function () {
        var request = new sql.Request();

        if (inputParamJson) {
            Object.keys(inputParamJson).forEach(function (key, idx) {
                request.input(key, inputParamJson[key].type, inputParamJson[key].value);
            });
        }

        request.query(sqlComm).then(function (recordSet) {
            callback(null, recordSet);
        }).catch(function (err) {
            callback(err);
        });

    }).catch(function (err) {
        callback(err);
    });
}

/**
 * 執行資料庫異動
 *
 * sqlComm： SQL Modify Command
 * paramsJson： preparedSql 參數
 * callback： 回應函式
 */
mssqlTools.prototype.execModify = function (sqlComm, inputParamJson, callback) {
    sql.connect(dbConfig).then(function () {
        var request = new sql.Request();

        if (inputParamJson) {
            Object.keys(inputParamJson).forEach(function (key, idx) {
                request.input(key, inputParamJson[key].type, inputParamJson[key].value);
            });
        }

        request.query(sqlComm).then(function () {
            callback(null, request.rowsAffected);
        }).catch(function (err) {
            callback(err);
        });

    }).catch(function (err) {
        callback(err);
    });
}

/**
 * 執行 SQL 預存程序
 *
 * procedureName： 預存程序名稱
 * paramsJson： 預存程序參數
 * callback： 回應函式
 */
mssqlTools.prototype.execStoredProcedure = function (procedureName, inputParamJson, outputParamJson, callback) {
    sql.connect(dbConfig).then(function () {
        var request = new sql.Request();

        if (inputParamJson){
            Object.keys(inputParamJson).forEach(function (key, idx) {
                request.input(key, inputParamJson[key].type, inputParamJson[key].value);
            });
        }

        if (outputParamJson){
            Object.keys(outputParamJson).forEach(function (key, idx) {
                request.output(key, outputParamJson[key].type);
            });
        }
        
        request.execute(procedureName).then(function (recordSet) {
            callback(null, recordSet, request.parameters);
        }).catch(function (err) {
            callback(err);
        });

    }).catch(function (err) {
        callback(err);
    });
}

module.exports = mssqlTools;