'use strict';

var fs = require("fs");
var path = require("path");
var qiniu = require("qiniu");

class Upload {
    constructor(options) {
        this.accessKey = options.accessKey;
        this.secretKey = options.secretKey;
        this.bucket = options.bucket;
        this.host = options.host;
        this.zone = options.zone || 'up-z0.qiniu.com';
        this.client_zone = options.client_zone || 'upload-z0.qiniu.com';
        this.returnBody = options.returnBody || '{"key":"$(key)","hash":"$(etag)","fsize":$(fsize),"bucket":"$(bucket)"}';
        this.expires = options.deadline || 7200;  //2h
        this.mac = new qiniu.auth.digest.Mac(this.accessKey, this.secretKey);
        this.qn_conf = qiniu.zone[this.zone];
        this.putExtra = new qiniu.form_up.PutExtra();

    }

    uploadToken(options ={}) {
        let tokenOption = {
            scope: options.scope || this.bucket,
            expires: options.expires || this.expires,
            returnBody: options.returnBody || this.returnBody
        };
        return new qiniu.rs.PutPolicy(tokenOption).uploadToken(this.mac);
    }

    putFileUpload(filePath = '', {key, scope}, cb) {
        if(!key) key = path.basename(filePath);
        let hasCb = false;
        if(typeof key === 'function') {
            cb = key;
            key = path.basename(filePath);
            hasCb = true;
        }
        if(cb) hasCb = true;

        if (!fs.existsSync(filePath)) {
            let error = new Error('文件不存在');
            error.status = 404;
            if(hasCb) return cb(error);
            return Promise.reject(error);
        }

        return new Promise((resolve, reject) => {
            let formUploader = new qiniu.form_up.FormUploader(this.qn_conf);
            // 文件上传
            formUploader.putFile(this.uploadToken({scope}), key, filePath, this.putExtra, (err, result) => {
                
                if (!err && !result.error) {
                    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    let resp = {
                        'url': this.host + '/' + result.key,
                        'size': result.fsize,
                        'state': 'SUCCESS'
                    };
                    if(cb) return cb(err, resp);

                    return resolve(resp);	//上传成功，返回 url
                } else {
                    let error = err;
                    if ((err && err.error) || (result && result.error)) {
                         error = new Error(err ? err.error : result.error);
                        //error.status = err.code;
                    }
                    if(cb) return cb(error);
                    return reject(error);
                }
            });
        });
    }

    putStreamUpload(stream = '', {key, scope}, cb) {
        return new Promise((resolve, reject) => {

            let formUploader = new qiniu.form_up.FormUploader(this.qn_conf);
            // 文件流上传
            formUploader.putStream(this.uploadToken({scope}), key, stream, this.putExtra, (err, result) => {
                if (!err && !result.error) {
                    let resp = {
                        'url': this.host + '/' + result.key,
                        'size': result.fsize,
                        'state': 'SUCCESS'
                    };
                    if(cb) return cb(err, resp);

                    return resolve(resp);	//上传成功，返回 url
                } else {
                    let error = err;
                    if ((err && err.error) || (result && result.error)) {
                         error = new Error(err ? err.error : result.error);
                        //error.status = err.code;
                    }
                    if(cb) return cb(error);
                    return reject(error);
                }
            });
        });
    }

}



module.exports = Upload;

