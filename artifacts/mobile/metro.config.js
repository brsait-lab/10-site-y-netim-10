const { getDefaultConfig } = require("expo/metro-config");
const { createProxyMiddleware } = require("http-proxy-middleware");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /node_modules\/.*\/_tmp_.*/,
  /node_modules\/.pnpm\/.*_tmp_.*/,
  /node_modules\/.pnpm\/bullmq@.*\/node_modules\/bullmq_tmp_.*/,
  /node_modules\/.pnpm\/ioredis@.*\/node_modules\/ioredis\/built\/cluster\/.*/,
];

const apiProxy = createProxyMiddleware({
  target: "http://localhost:3000",
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "API sunucusuna bağlanılamadı." }));
    },
  },
});

config.server = {
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      if (req.url.startsWith("/api/") || req.url === "/api") {
        return apiProxy(req, res, next);
      }
      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;
