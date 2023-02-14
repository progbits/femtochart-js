const HtmlWebPackPlugin = require("html-webpack-plugin");

module.exports = {
    mode: 'development',
    plugins: [
        new HtmlWebPackPlugin({
            template: "./src/index.html",
            filename: "./index.html"
        })
    ]
};
