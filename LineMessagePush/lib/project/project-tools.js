var appConfig = require(global.APP_ROOT_PATH + '/app-config'),
    request = require('request');


/**
 * 發送文字訊息至 Line 伺服器
 *
 * toAry： 接收者名單陣列
 * text： 要發送的文字
 */
function pushLineTextMessage(toAry, text, headers, callback) {
    request(
        {
            method: 'post',
            url: appConfig.LINE_FIXED_INFO.LINE_MESSGAE_SERVER,
            headers: headers,
            body: JSON.stringify({
                to: toAry,
                toChannel: appConfig.LINE_FIXED_INFO.SNED_TO_CHANNEL,
                eventType: appConfig.LINE_FIXED_INFO.SEND_EVENT_TYPE,
                content: {
                    contentType: 1,
                    toType: 1,
                    text: text
                }
            })
        }, function (err, res, body) {
            callback(err, res);
        }
    );
}

module.exports = {
    pushLineTextMessage: pushLineTextMessage
}