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
    config.limit = config.limit || 10 * 1024 * 1024;//上传大小限制,默认10M

    return function (req, res, next) {
        if (req.headers['content-length'] > config.limit) {
            res.statusCode = 413;
            return next(413);
        }

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
        req.body = req.body || {};
        req.files = req.files || {};


        var busboy = new Busboy({
            headers: req.headers
        });
        busboy.on('field', (name, data) => {
            convertParams(req.body, name, data);
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
            res.upload = function (img_url, cb) {
                if (config.qn) {        //直接上传七牛
                    if(typeof img_url === 'function') cb = img_url;

                    var name = snowflake.nextId() + path.extname(filename);

                    let key = `${config.qn.prefix || 'r'}/${moment().format('YYYYMMDD')}/${name}`;

                    qn.create(config.qn).upload(file, {key}, function (err, results) {      //例如： r/20170908/dafhfjaadfkjsdhjdf.jpg
                        if(err) return cb(err);
                        cb(err, {
                            'url': results.url,
                            'title': req.body.pictitle,
                            'size': results.fsize,
                            'original': filename,
                            'state': 'SUCCESS'
                        });
                    });
                    return false
                } else {
                    var tmpdir = path.join(os.tmpdir(), path.basename(filename));
                    var name = snowflake.nextId() + path.extname(tmpdir);
                    var dest = path.join(static_url, img_url, name);

                    var writeStream = fs.createWriteStream(tmpdir);
                    file.pipe(writeStream);
                    writeStream.on("close", function () {
                        fse.move(tmpdir, dest, function (err) {
                            if (err)  return cb(err);
                            cb(err, {
                                'url': path.join(img_url, name).replace(/\\/g, '/'),
                                'original': filename,
                                'state': 'SUCCESS'
                            });
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
