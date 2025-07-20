const path = require('path');

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';
  
  return {
    entry: {
      background: './js/background.js',
      content: './js/content.js',
      sidebar: './js/sidebar.js',
      popup: './popup.js'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'js/[name].js',
      clean: true
    },
    mode: argv.mode || 'development',
    devtool: isDevelopment ? 'source-map' : false,
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[name][ext]'
          }
        }
      ]
    },
    resolve: {
      extensions: ['.js', '.json']
    },
    plugins: [],
    optimization: {
      minimize: !isDevelopment
    }
  };
};