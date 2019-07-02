var Busboy = require('busboy');
var fs = require('fs');
var fse = require('fs-extra');
var os = require('os');
var path = require('path');
var snowflake = require('node-snowflake').Snowflake;
var qiniu = require('qiniu');
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


                    let uploadToken = new qiniu.rs.PutPolicy(config.qn).uploadToken(new qiniu.auth.digest.Mac(config.qn.accessKey,config.qn.secretKey));

                    // 配置conf
                    let conf = new qiniu.conf.Config();
                    if(typeof config.qn.zone === 'string'){
                        conf.zone = qiniu.zone[config.qn.zone];
                    }else{

                        let zone_name = config.qn.zone.name;
                        let {api_host, rsf_host, uc_host} = config.qn.zone;
                        qiniu.zone[zone_name] = new qiniu.conf.Zone(...[
                            [ api_host],
                            [ api_host],
                            api_host,
                            rsf_host,
                            rsf_host,
                            api_host
                        ]);

                        conf.zone = qiniu.zone[zone_name]
                    }

                    // 配置PutExtra
                    let PutExtra = new qiniu.form_up.PutExtra();
                    PutExtra.fname = filename;
                    PutExtra.mimeType = mimetype;


                    let formUploader = new qiniu.form_up.FormUploader(conf);

                    formUploader.putStream(uploadToken, key, file, PutExtra, function(err, results) {

                        if(err) return cb(err);
                        cb(err, {
                            'mimetype': mimetype,
                            'url': config.qn.host + '/' + results.key,
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
