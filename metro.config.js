const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const nodeModules = {
  stream: require.resolve("readable-stream"),
  zlib: require.resolve("browserify-zlib"),
  path: require.resolve("path-browserify"),
  crypto: require.resolve("react-native-crypto"),
  http: require.resolve("stream-http"),
  https: require.resolve("https-browserify"),
  os: require.resolve("react-native-os"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (nodeModules[moduleName]) {
    return {
      filePath: nodeModules[moduleName],
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
