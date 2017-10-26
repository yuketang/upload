var Busboy = require('busboy');
var fs = require('fs');
var fse = require('fs-extra');
var os = require('os');
var path = require('path');
var snowflake = require('node-snowflake').Snowflake;
var qn = require('qn');
let moment = require('moment');

var isEmpty = function (obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

var convertParams = (item, name, data) => {
    if (Array.isArray(item[name])) {
        item[name].push(data);
    } else if (item[name]) {
        item[name] = [item[name], data];
    } else {
        item[name] = data;
    }
};

var upload = function (static_url, config = {}, handel) {
    return function (req, res, next) {
        var _respond = respond(static_url, config, handel);
        _respond(req, res, next);
    };
};
var respond = function (static_url, config = {}, callback) {
    if (typeof config === 'function') {
        callback = config
        config = {}
    }

    return function (req, res, next) {
        var busboy = new Busboy({
            headers: req.headers
        });
        busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {

            const data = {
                fieldname: fieldname,
                filename: filename,
                encoding: encoding,
                mimetype: mimetype,
                truncated: false,
                done: false,
                file: file
            };
            res.upload = function (img_url) {
                if (config.qn) {        //直接上传七牛
                    var name = snowflake.nextId() + path.extname(filename);
                    config.qn.prefix
                    let key =  `${config.qn.prefix ||'r'}/${moment().format('YYYYMMDD')}/${name}`;

                    var client = qn.create(config.qn).upload(file, {key}, function (err, results) {      //例如： r/20170908/dafhfjaadfkjsdhjdf.jpg
                        if (err) throw err;

                        let resp = {
                            'url': results.url,
                            'original': filename,
                            'state': 'SUCCESS'
                        };

                        res.json(resp);
                    });
                    return false
                }

                //默认上传到项目目录(config对象为空时) 或者 config.local , config.qn 都为 true 时会同时上传到七牛及项目目录
                if (!config || isEmpty(config) || config.local) {
                    var tmpdir = path.join(os.tmpdir(), path.basename(filename));
                    var name = snowflake.nextId() + path.extname(tmpdir);
                    var dest = path.join(static_url, img_url, name);

                    var writeStream = fs.createWriteStream(tmpdir);
                    file.pipe(writeStream);
                    writeStream.on("close", function () {
                        fse.move(tmpdir, dest, function (err) {
                            if (err) throw err;
                            res.json({
                                'url': path.join(img_url, name).replace(/\\/g, '/'),
                                'original': filename,
                                'state': 'SUCCESS'
                            })
                        });
                    })
                }
            }
            convertParams(req.files, fieldname, data);
            callback(req, res, next);
        });

        req.pipe(busboy);
        return;
    };
};
module.exports = upload;
