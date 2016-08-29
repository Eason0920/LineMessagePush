module.exports = {
    HTTPS_SERVER_PORT: 443,     //HTTPS 伺服器埠號
    SYSTEM_ADMIN_ACCOUNT: 'system_admin',       //使用系統身份異動資料庫帳號名稱

    //SSL 憑證檔案路徑
    SSL_AUTH_FILES: {
        KEY: global.APP_ROOT_PATH + '/ssl/KEY.key',
        CERT: global.APP_ROOT_PATH + '/ssl/CERT.crt',
        CA: global.APP_ROOT_PATH + '/ssl/CA.crt'
    },

    //LINE 固定值資訊
    LINE_FIXED_INFO: {
        SNED_TO_CHANNEL: '1383378250',     //(固定)傳送訊息頻道代碼
        SEND_EVENT_TYPE: '138311608800106203',     //(固定)傳送訊息事件類型代碼
        RECEIVE_ACTION_EVENT_TYPE: '138311609100106403',       //(固定)接收操作指令 (如加好友)
        RECEIVE_MSG_EVENT_TYPE: '138311609000106303',      //(固定)接收訊息 (如訊息或照片)
        LINE_MESSGAE_SERVER: 'https://trialbot-api.line.me/v1/events'     //(固定)傳送訊息位址
    },

    //發送資料至 LINE 各頻道伺服器 HEADER 資訊
    LINE_CHANNEL_REQUEST_HEADERS: {
        WEATHER: {
            'Content-Type': 'application/json; charset=utf8',
            'X-Line-ChannelID': 123456789,
            'X-Line-ChannelSecret': 'X-Line-ChannelSecret',
            'X-Line-Trusted-User-With-ACL': 'X-Line-Trusted-User-With-ACL'
        }
    },

    //資料庫連線資訊
    MSSQL_CONNECTION_INFO: {
        SERVER: 'x.x.x.x',
        PORT: 1433,
        DATABASE: 'LineMessagePush',
        USER: 'USER',
        PASSWORD: 'PASSWORD'
    },

    //寄發電子郵件主機資訊
    EMAIL_SERVER_INFO: {
        USER: 'USER',
        PASS: 'PASS',
        SECURE: false,
        SMTP: 'SMTP',
        PORT: 25
    },

    //各頻道電子郵件寄件者與接收者資訊
    EMAIL_CHANNEL_SENDER_RECEIVERS: {
        WEATHER: {
            SENDER: '天氣速報 Line 訊息推播程式 <SENDER@mail>',
            RECEIVERS: ['RECEIVERS']
        }
    },

    //測試推播訊息前綴
    TEST_LINE_PUSH_MESSAGE_PREFIX: {
        WEATHER: '【測試】'
    }
};