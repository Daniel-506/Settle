const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const nodeModuleMap = {
    stream: "readable-stream",
    zlib: "browserify-zlib",
    path: "path-browserify",
    http: "stream-http",
    https: "https-browserify",
    crypto: "react-native-crypto-js",
    util: "util",
    ws: "react-native",
  };

  if (nodeModuleMap[moduleName]) {
    if (moduleName === "ws") {
      return context.resolveRequest(context, "react-native", platform);
    }
    try {
      return {
        filePath: require.resolve(nodeModuleMap[moduleName]),
        type: "sourceFile",
      };
    } catch {
      return context.resolveRequest(context, moduleName, platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
