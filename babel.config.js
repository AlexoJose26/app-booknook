module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // mantém este plugin
      [
        'module-resolver',
        {
          alias: {
            '@': './', // permite "@/database" e "@/app/..."
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
    ],
  };
};
