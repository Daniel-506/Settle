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
    util: "util/", // trailing slash = the npm package, not Node's built-in
    ws: "react-native",
  };

  // These Node polyfills are for the native (iOS/Android) builds only.
  // Web already has the real APIs, and swapping them breaks the web build.
  if (platform !== "web" && nodeModuleMap[moduleName]) {
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
