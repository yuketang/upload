# Node.js : upload
此项目只供yuketang内部使用

##Installation

```
 npm install github:yuketang/ws --save
```

### 上传配置

```javascript
app.use("/ueditor/ue", static_url, config = {}, callback);
```



#示例

## 上传到服务器本地（分布式服务慎用）

```javascript
var upload = require("upload")

// config提供一些上传的参数，可以不传
var config = {
  limit: 10 * 1024 * 1024			// 默认上传限制为10M
};
app.use("/upload", upload(path.join(__dirname, 'public'), config, function(req, res, next) {
    // 这里你可以获得文件之外字段的信息
	var body = req.body;
	console.log(body.someField);  // xxxx

  	// 这里你可以获得上传文件的信息
    var files = req.files;

	// 例如获取文件foo的信息
    console.log(files.foo.filename); // exp.png
    console.log(files.foo.encoding); // 7bit
    console.log(files.foo.mimetype); // image/png
	console.log(files.foo.fieldname) // foo

    // 下面填写你要把文件保存到的路径 （ 以 path.join(__dirname, 'public') 作为根路径）
  	// 此路径只在要保存到服务器本地时需要
    var img_url = 'yourpath';

    res.upload(img_url, function(err, result){	// 上传
        res.send(result);						// 上传结束后在这里可以对结果进行进一步处理
    });
});
```
## 七牛上传

当配置了 config.qn 图片则只会上传到七牛服务器而不会上传到项目目录。

```javascript
var upload = require("upload")

// 支持七牛上传，如有需要请配置好config.qn参数，如果没有qn参数则存储在本地
var config = {
    qn: {
        accessKey: 'your access key',
        secretKey: 'your secret key',
        bucket: 'your bucket name',
        origin: 'your cdn host',			//例如：http://{bucket}.u.qiniudn.com
      	uploadURL: 'bucket region'			//华东：up.qiniup.com 或 up-z0.qiniup.com（默认）; 华北：up-z1.qiniup.com；华南：up-z2.qiniup.com；北美：up-na0.qiniup.com
    },
  limit: 20 * 1024 *1024
}

app.use("/ueditor/ue", ueditor(path.join(__dirname, 'public'), config, function(req, res, next) {
    // 这里你可以获得文件之外字段的信息
	var body = req.body;
	console.log(body.someField);  // xxxx

  	// 这里你可以获得上传文件的信息
    var files = req.files;

	// 例如获取文件foo的信息
    console.log(files.foo.filename); // exp.png
    console.log(files.foo.encoding); // 7bit
    console.log(files.foo.mimetype); // image/png
	console.log(files.foo.fieldname) // foo

    res.upload(function(err, result){			// 上传
        res.send(result);						// 上传结束后在这里可以对结果进行进一步处理
    });
});

```

