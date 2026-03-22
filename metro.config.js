const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
  resolver: {
    assetExts: ['bin', 'txt', 'jpg', 'png', 'gif', 'webp', 'ttf', 'otf'],
    sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json', 'svg'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
