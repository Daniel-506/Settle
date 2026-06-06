const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "stream") {
    return { filePath: require.resolve("readable-stream"), type: "sourceFile" };
  }
  if (moduleName === "zlib") {
    return { filePath: require.resolve("browserify-zlib"), type: "sourceFile" };
  }
  if (moduleName === "path") {
    return { filePath: require.resolve("path-browserify"), type: "sourceFile" };
  }
  if (moduleName === "http") {
    return { filePath: require.resolve("stream-http"), type: "sourceFile" };
  }
  if (moduleName === "https") {
    return {
      filePath: require.resolve("https-browserify"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
