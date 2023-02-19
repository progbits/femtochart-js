import HtmlWebPackPlugin from 'html-webpack-plugin'

export default {
  mode: 'development',
  plugins: [
    new HtmlWebPackPlugin({
      template: './src/index.html',
      filename: './index.html',
    }),
  ],
}
