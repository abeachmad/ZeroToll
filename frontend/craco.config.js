// craco.config.js
const path = require("path");
require("dotenv").config();

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      // Optimize watch options
      webpackConfig.watchOptions = {
        ...webpackConfig.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/build/**',
          '**/dist/**',
          '**/coverage/**',
          '**/public/**',
        ],
      };

      // Ignore MetaMask SDK warnings
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
        /Can't resolve '@react-native-async-storage\/async-storage'/,
      ];

      return webpackConfig;
    },
  },
};
