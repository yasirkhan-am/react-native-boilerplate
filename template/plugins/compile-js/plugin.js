/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-console */
const { execSync, spawnSync } = require('node:child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const isWindows = os.platform() === 'win32';
const TYPESCRIPT_VERSION = '5.6.3';

function isYarnAvailable() {
  try {
    execSync(isWindows ? 'yarn.cmd --version' : 'yarn --version', {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function isNpmAvailable() {
  try {
    execSync(isWindows ? 'npm.cmd --version' : 'npm --version', {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

function getNpxCommand() {
  return isWindows ? 'npx.cmd' : 'npx';
}

function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️  Source not found: ${src}`);
    return;
  }

  ensureDirExists(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function deleteDirRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

module.exports = {
  async apply(value) {
    return new Promise((resolve) => {
      let packageManager = null;
      let addCmd = null;

      if (isYarnAvailable()) {
        packageManager = isWindows ? 'yarn.cmd' : 'yarn';
        addCmd = 'add';
      } else if (isNpmAvailable()) {
        packageManager = isWindows ? 'npm.cmd' : 'npm';
        addCmd = 'install';
      }

      if (!packageManager) {
        console.error('🚨 No package manager found. Please install yarn or npm.');
        process.exit(1);
      }

      console.log("🚀 ~ Using package manager:", packageManager);

      if (!value) {
        console.log('\n📦 Loading the build tool...');

        const installTypeScriptCmd = spawnSync(
          packageManager,
          [addCmd, '-D', `typescript@${TYPESCRIPT_VERSION}`],
          { stdio: 'inherit', shell: isWindows },
        );

        if (installTypeScriptCmd.error) {
          console.error(installTypeScriptCmd.error);
          process.exit(1);
        }

        console.log('🧱 Building the javascript source...');
        const transpileCmd = spawnSync(
          getNpxCommand(),
          ['tsc', '--project', 'plugins/compile-js/tsconfig.build.json'],
          { stdio: 'inherit', shell: isWindows },
        );

        if (transpileCmd.error) {
          console.error(transpileCmd.error);
          process.exit(1);
        }

        try {
          console.log('🖼️  Copying assets...');
          copyDirRecursive('src/theme/assets/images', 'js/src/theme/assets/images');

          console.log('♻️  Replacing source...');
          deleteDirRecursive('src');
          copyDirRecursive('js/src', './src');

          deleteDirRecursive('__mocks__');
          copyDirRecursive('js/__mocks__', './__mocks__');

          deleteDirRecursive('js');
        } catch (err) {
          console.error(
            '🚨 Failed to copy assets or replace source. If you are using Windows, please use Git Bash.',
          );
          console.error(err);
          process.exit(1);
        }

        console.log('🌀 Removing types ...');
        deleteDirRecursive('src/theme/types');
        try {
          fs.unlinkSync('src/navigation/paths.js');
        } catch {}
        try {
          fs.unlinkSync('src/navigation/types.js');
        } catch {}
      }

      resolve();
    });
  },
};
