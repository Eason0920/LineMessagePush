/**
 * @description Node.js 檔案處理函式庫版本建立
 * @author Eason
 * @since 20160701
 * @version 1
 */
/**
 * @description 新增函示
 * 1. readFileContent(讀取檔案內容)
 * 2. createFileIfNotExists(檢查檔案是否存在，若不存在則建立)
 * @author Eason
 * @since 20160720
 * @version 2
 */

var fs = require('fs');

/**
 * 新增或覆蓋檔案
 * 
 * dir： 檔案目錄
 * fileNameWithExt： 檔名與副檔名
 * content： 要寫入的內容
 * callback：回應函式
 */
function createOrWriteFile(dir, fileNameWithExt, content, callback) {
    checkOrCreateDir(dir, function (err) {
        if (!err) {
            var filePath = dir + fileNameWithExt;
            checkPathCanWrite(filePath, function (err) {
                if (!err) {
                    fs.writeFile(filePath, content, function (err) {
                        if (!err) {
                            callback(null);
                        } else {        //寫入檔案失敗
                            callback(err);
                        }
                    });
                } else {        //檢查檔案是否有寫入權限失敗
                    callback(err);
                }
            });
        } else {        //檢查檔案目錄失敗
            callback(err);
        }
    });
};

/**
 * 新增或追加檔案內容
 * 
 * dir： 檔案目錄
 * fileNameWithExt： 檔名與副檔名
 * content： 要寫入的內容
 * callback：回應函式
 */
function createOrAppendFile(dir, fileNameWithExt, content, callback) {
    checkOrCreateDir(dir, function (err) {
        if (!err) {
            var filePath = dir + fileNameWithExt;
            checkPathCanWrite(filePath, function (err) {
                if (!err) {
                    fs.appendFile(filePath, content, function (err) {
                        if (!err) {
                            callback(null);
                        } else {        //寫入檔案失敗
                            callback(err);
                        }
                    });
                } else {        //檢查檔案是否有寫入權限失敗
                    callback(err);
                }
            });
        } else {        //檢查檔案目錄失敗
            callback(err);
        }
    });
};

/**
 * 檢查目錄是否存在或建立
 * 
 * dir： 目錄路徑
 * callback： 回應函式
 */
function checkOrCreateDir(dir, callback) {
    fs.stat(dir, function (err, stats) {
        if (err) {
            fs.mkdir(dir, function (err) {
                if (!err) {
                    callback(null);
                } else {        //產生目錄失敗
                    callback(err);
                }
            });
        } else {
            callback(null);
        }
    });
};

/**
 * 檢查檔案或目錄是否有寫入權限
 * 
 * path： 檔案或目錄路徑
 * callback： 回應函式
 */
function checkPathCanWrite(path, callback) {
    fs.stat(path, function (err, stats) {
        if (err) {
            callback(null);
        } else {
            fs.access(path, fs.W_OK, function (err) {
                if (err) {      //檔案或目錄沒有寫入權限
                    callback(err);
                } else {
                    callback(null);
                }
            });
        }
    });
};

/**
 * 讀取檔案內容
 * 
 * path： 檔案路徑
 * callback： 回應函式
 */
function readFileContent(path, callback) {
    fs.readFile(path, 'utf8', function (err, content) {
        callback(err, content);
    });
};

/**
 * 檢查檔案是否存在，若不存在則建立
 * 
 * dir： 檔案目錄
 * fileNameWithExt： 檔名與副檔名
 * content： 要寫入的內容
 * callback：回應函式
 */
function createFileIfNotExists(dir, fileNameWithExt, content, callback) {
    fs.stat(dir + fileNameWithExt, function (err1, stats) {
        if (err1) {
            createOrWriteFile(dir, fileNameWithExt, content, function (err2) {
                callback(err2);
            });
        } else {
            callback(err1);
        }
    });
};

module.exports = {
    createOrWriteFile: createOrWriteFile,
    createOrAppendFile: createOrAppendFile,
    checkOrCreateDir: checkOrCreateDir,
    checkPathCanWrite: checkPathCanWrite,
    readFileContent: readFileContent,
    createFileIfNotExists: createFileIfNotExists
};