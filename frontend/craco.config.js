// craco.config.js
const path = require("path");
const webpack = require("webpack");
require("dotenv").config();

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      // CRITICAL: Force @metamask packages to use their own superstruct
      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        '@metamask/superstruct': path.resolve(__dirname, 'node_modules/@metamask/superstruct'),
      };
      
      // Add fallbacks for Node.js modules used by @metamask packages
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "crypto": false,
        "stream": false,
        "buffer": false,
      };

      // IMPORTANT: Ensure ESM modules are properly resolved
      // This is needed for @metamask/smart-accounts-kit and its dependencies
      webpackConfig.resolve.extensionAlias = {
        '.js': ['.ts', '.tsx', '.js', '.jsx'],
        '.mjs': ['.mts', '.mjs'],
        '.cjs': ['.cts', '.cjs'],
      };

      // Force webpack to use the correct module type for @metamask packages
      webpackConfig.module = webpackConfig.module || {};
      webpackConfig.module.rules = webpackConfig.module.rules || [];
      
      // Add rule to handle .mjs files from @metamask packages
      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        include: /node_modules\/@metamask/,
        resolve: {
          fullySpecified: false,
        },
        type: 'javascript/auto',
      });

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

      // Ignore warnings
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
        /Can't resolve '@react-native-async-storage\/async-storage'/,
        /Critical dependency/,
      ];

      return webpackConfig;
    },
  },
};
