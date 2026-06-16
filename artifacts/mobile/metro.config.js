const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /node_modules\/.*\/_tmp_.*/,
  /node_modules\/.pnpm\/.*_tmp_.*/,
  /node_modules\/.pnpm\/bullmq@.*\/node_modules\/bullmq_tmp_.*/,
  /node_modules\/.pnpm\/ioredis@.*\/node_modules\/ioredis\/built\/cluster\/.*/,
];

module.exports = config;
