const path = require('path');

module.exports = {
    mode: 'development',
    devServer: {
        contentBase: path.join(__dirname, '/dist/public'),
        port: 8080,
        host: `localhost`,
    },
    entry: {
        app: ['./dist/src_client/index.js']
    },
    output: {
        path: path.join(__dirname, 'dist'),
        publicPath: '/js/',
        filename: `[name].js`,
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                [
                                    '@babel/preset-env',
                                    {
                                        'modules': 'auto',//commonjs,amd,umd,systemjs,auto
                                        'useBuiltIns': 'usage',
                                        'targets': '> 0.25%, not dead',
                                        'corejs': 3
                                    }
                                ]
                            ]
                        }
                    }
                ]
            }
        ]
    },
    resolve: {
        alias: {}
    },
    plugins: [],

};