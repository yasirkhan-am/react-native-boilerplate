/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-console */
const { execSync, spawnSync } = require('node:child_process');

const TYPESCRIPT_VERSION = '5.6.3';

function isYarnAvailable() {
  try {
    return !!(
      execSync('yarn --version', {
        stdio: [0, 'pipe', 'ignore'],
      }).toString() || ''
    ).trim();
  } catch {
    return null;
  }
}

function isNpmAvailable() {
  try {
    return !!(
      execSync('npm --version', {
        stdio: [0, 'pipe', 'ignore'],
      }).toString() || ''
    ).trim();
  } catch {
    return null;
  }
}

function getSafeCommand(cmd) {
  // Fix spawnSync issues on Windows
  return process.platform === 'win32' ? `${cmd}.cmd` : cmd;
}

module.exports = {
  async apply(value) {
    return new Promise((resolve) => {
      let packageManager = null;
      let addCmd = null;

      // Prefer yarn, fallback to npm
      if (isYarnAvailable()) {
        packageManager = 'yarn';
        addCmd = 'add';
      } else if (isNpmAvailable()) {
        packageManager = 'npm';
        addCmd = 'install';
      }

      if (!packageManager) {
        console.error('🚨 No package manager found. Please install yarn or npm.');
        process.exit(1);
      }

      // If the user chose JavaScript
      if (!value) {
        console.log('\n🧪 JavaScript selected — skipping TypeScript install');

        try {
          console.log('📁 Copying JS source files...');
          execSync('cp -R js/src ./src', { stdio: 'pipe' });
          execSync('cp -R js/__mocks__ ./__mocks__', { stdio: 'pipe' });
          execSync('rm -rf js', { stdio: 'pipe' });
        } catch {
          console.error('🚨 Failed to copy JS source files. Use Git Bash on Windows.');
          process.exit(1);
        }

        return resolve();
      }

      // If the user chose TypeScript
      console.log('\n📦 Loading the build tool...');
      const installTypeScriptCmd = spawnSync(
        getSafeCommand(packageManager),
        [addCmd, '-D', `typescript@${TYPESCRIPT_VERSION}`],
        { stdio: 'inherit' },
      );
      if (installTypeScriptCmd.error) {
        console.error(installTypeScriptCmd.error);
        process.exit(1);
      }

      console.log('🧱 Building the JavaScript source (from TS)...');
      const transpileCmd = spawnSync(
        getSafeCommand('npx'),
        ['tsc', '--project', 'plugins/compile-js/tsconfig.build.json'],
        { stdio: 'inherit' },
      );
      if (transpileCmd.error) {
        console.error(transpileCmd.error);
        process.exit(1);
      }

      try {
        console.log('🖼️  Copying assets...');
        execSync('cp -R src/theme/assets/images js/src/theme/assets/images');

        console.log('♻️  Replacing source...');
        execSync('rm -rf src', { stdio: 'pipe' });
        execSync('cp -R js/src ./src', { stdio: 'pipe' });
        execSync('rm -rf __mocks__', { stdio: 'pipe' });
        execSync('cp -R js/__mocks__ ./__mocks__', { stdio: 'pipe' });
        execSync('rm -rf js', { stdio: 'pipe' });
      } catch {
        console.error('🚨 Failed to copy assets or replace source. Use Git Bash on Windows.');
        process.exit(1);
      }

      console.log('🌀 Cleaning up type definitions...');
      execSync('rm -rf src/theme/types', { stdio: 'pipe' });
      execSync('rm -f src/navigation/paths.js', { stdio: 'pipe' });
      execSync('rm -f src/navigation/types.js', { stdio: 'pipe' });

      resolve();
    });
  },
};
