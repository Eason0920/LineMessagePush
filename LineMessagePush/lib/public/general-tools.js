/**
 * @description Node.js 一般常用函式庫版本建立
 * @author Eason
 * @since 20160729
 * @version 1
 */

var os = require('os');

//為字串定義 replaceAll 方法
String.prototype.replaceAll = function (search, replacement) {
    var self = this;
    return self.replace(new RegExp(search, 'g'), replacement);
};

/**
 * 將字串陣列內容依據指定分隔符號連接成單一字串
 * 
 * stringAry： 字串陣列
 * symbo： 分隔符號
 */
function concatStringArray(stringAry, symbo) {
    var result = '';
    if (stringAry.length > 0) {
        for (var str in stringAry) {
            result += ((result.length > 0) ? symbo : '') + stringAry[str];
        }
    }
    return result;
};

/**
 * 複製 json 物件
 * 
 * jsonObj： 要複製的來源 json 物件
 */
function cloneJsonObject(jsonObj) {
    return JSON.parse(JSON.stringify(jsonObj));
};

/**
 * 取得主機 IP address 資訊
 * 
 * familyType： ipv4 或 ipv6
 */
function getHostIps(familyType) {
    var interfaces = os.networkInterfaces();
    var ips = {
        ipv4: [],
        ipv6: []
    };
    
    Object.keys(interfaces).forEach(function (ifname) {
        interfaces[ifname].forEach(function (iface) {
            if (!iface.internal) {
                if (!familyType) {
                    ips[iface.family.toLowerCase()].push(iface.address);
                } else if (iface.family.toLowerCase() === familyType.toLowerCase()) {
                    ips[iface.family.toLowerCase()].push(iface.address);
                }
            }
        });
    });
    
    return ips;
};


module.exports = {
    concatStringArray: concatStringArray,
    cloneJsonObject: cloneJsonObject,
    getHostIps: getHostIps
}