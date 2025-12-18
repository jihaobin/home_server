const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('@expo/config-plugins');

const DEFAULT_FILENAME = 'timpush-configs.json';

module.exports = function withTimpushConfig(
  config,
  { source = `./plugins/${DEFAULT_FILENAME}`, targetFilename = DEFAULT_FILENAME } = {}
) {
  return withDangerousMod(config, [
    'android',
    config => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      const inputPath = path.resolve(projectRoot, source);

      if (!fs.existsSync(inputPath)) {
        throw new Error(`缺少 ${inputPath}，请先下载 ${DEFAULT_FILENAME} 后再运行预构建。`);
      }

      const assetsDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'assets');
      fs.mkdirSync(assetsDir, { recursive: true });

      const outputPath = path.join(assetsDir, targetFilename);
      fs.copyFileSync(inputPath, outputPath);
      console.log(`已复制 ${inputPath} -> ${outputPath}`);

      return config;
    },
  ]);
};
