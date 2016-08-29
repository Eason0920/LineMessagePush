/**
 * @description Node.js 電子郵件發送模組建立
 * @author Eason
 * @since 20160802
 * @version 1
 */

var nodemailer = require('nodemailer');
var smtpSettings = {
    host: null,
    port: null,
    secureConnection: null
}

/**
 * 郵件模組建構子
 * 
 * host： SMTP 郵件主機
 * port： 主機埠號
 * secure： 是否使用 SSL 連線
 * user： 寄件者使用者帳號
 * pass： 寄件者使用者密碼
 */
function emailModule(host, port, secure, user, pass) {
    smtpSettings.host = host;
    smtpSettings.port = port;
    smtpSettings.secureConnection = secure;

    //判斷若有傳入帳號密碼，則使用帳密驗證，否則使用匿名驗證(mail server 須設定)
    if (user && pass) {
        smtpSettings.auth = {
            user: user,
            pass: pass
        };
    }
};

/**
 * 寄送郵件
 * 
 * sender： 寄件者
 * receivers： 接收者 (多人可用陣列)
 * subject： 郵件主旨
 * text： 郵件文字內容
 * html： 郵件 html 內容
 * callback： 回應函式
 */
emailModule.prototype.sendMail = function (sender, receivers, subject, text, html, callback) {
    var mailTransport = nodemailer.createTransport('SMTP', smtpSettings);

    var mailOptions = {
        from: sender,
        to: receivers,
        subject: subject,
        text: text,
        html: html
    };

    if (mailTransport) {
        mailTransport.sendMail(mailOptions, function (err, info) {
            if (callback) {
                callback(err, info);
            }

            mailTransport.close();
        });
    }
};

module.exports = emailModule;

