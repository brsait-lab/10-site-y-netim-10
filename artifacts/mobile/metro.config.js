const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /node_modules\/.*\/aws-ssl-profiles_tmp_.*\/.*/,
];

module.exports = config;
