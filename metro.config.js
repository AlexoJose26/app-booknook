const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts = [
  ...config.resolver.assetExts,
  "wasm",
].filter((value, index, array) => array.indexOf(value) === index);

module.exports = config;
