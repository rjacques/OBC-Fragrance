import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { resolve } from 'node:path';

const candidatePaths = [
  process.env.SCORM_BUILD_SCRIPT
    ? resolve(process.cwd(), process.env.SCORM_BUILD_SCRIPT)
    : null,
  resolve(process.cwd(), 'scripts/build-scorm.mjs'),
  resolve(process.cwd(), '../../scripts/build-scorm.mjs'),
].filter(Boolean);

const scormBuildScript = candidatePaths.find((candidatePath) => {
  try {
    accessSync(candidatePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
});

if (!scormBuildScript) {
  console.log('Skipping SCORM packaging because no build script was found.');
  process.exit(0);
}

const result = spawnSync(process.execPath, [scormBuildScript], { stdio: 'inherit' });

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
