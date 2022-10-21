const express = require('express');
const multer = require('multer');
const multipart = multer();

const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');
const webpackHotMiddleware = require('webpack-hot-middleware');
const config = require('../../webpack.config.js');

const app = express();
const port = 8080;

const devServerEnabled = true;

if (devServerEnabled) {
    config.entry.app.unshift('webpack-hot-middleware/client?reload=true&timeout=1000');

    config.plugins.push(new webpack.HotModuleReplacementPlugin());

    const compiler = webpack(config);

    app.use(webpackDevMiddleware(compiler, {
        publicPath: config.output.publicPath
    }));

    app.use(webpackHotMiddleware(compiler));
}

app.use(express.static('./public'));

app.post('/api/add', multipart.any(), function (req, res) {

    const firstValue = parseInt(req.body.firstValue);
    const secondValue = parseInt(req.body.secondValue);
    const sum = firstValue + secondValue;
    res.json({sum: sum, firstValue: firstValue, secondValue: secondValue});
});

app.listen(port, () => {
    console.log('./public')
    console.log('Server started on port:' + port);
});