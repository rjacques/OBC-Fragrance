import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const scormDir = path.join(distDir, 'scorm');
const wrapperSource = path.join(rootDir, 'scripts', 'vendor', 'SCORM_API_wrapper.js');

const config = {
  courseTitle: 'My Astro Course',
  courseId: 'my-astro-course',
  launchFile: 'index.html',   // change if your launch page is different
  scormVersion: '1.2'         // this script is packaging SCORM 1.2
};


function getPrefixForHtml(htmlFile) {
  const htmlDir = path.dirname(htmlFile);
  const relToDist = toPosix(path.relative(htmlDir, distDir));
  return relToDist ? `${relToDist}/` : './';
}

function rewriteRootRelativeUrls(html, prefix) {
  return html
    .replace(/(href=)(["'])\/(?!\/)/g, `$1$2${prefix}`)
    .replace(/(src=)(["'])\/(?!\/)/g, `$1$2${prefix}`)
    .replace(/url\((["']?)\/(?!\/)/g, `url($1${prefix}`);
}


function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function escapeXml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function buildAdapterScript() {
  return `(function () {
  const api = window.pipwerks && window.pipwerks.SCORM;
  const config = window.__SCORM_CONFIG__ || {};

  if (!api) {
    console.warn('[SCORM] pipwerks wrapper not found.');
    return;
  }

  api.version = config.version || '1.2';

  const fields = api.version === '2004'
    ? {
        location: 'cmi.location',
        suspendData: 'cmi.suspend_data',
        completion: 'cmi.completion_status',
        success: 'cmi.success_status',
        scoreRaw: 'cmi.score.raw',
        scoreMin: 'cmi.score.min',
        scoreMax: 'cmi.score.max'
      }
    : {
        location: 'cmi.core.lesson_location',
        suspendData: 'cmi.suspend_data',
        completion: 'cmi.core.lesson_status',
        success: null,
        scoreRaw: 'cmi.core.score.raw',
        scoreMin: 'cmi.core.score.min',
        scoreMax: 'cmi.core.score.max'
      };

  const CourseSCORM = {
    initialized: false,

    init() {
      if (this.initialized) return true;
      const ok = api.init();
      this.initialized = !!ok;
      return !!ok;
    },

    get(name) {
      if (!this.initialized && !this.init()) return '';
      return api.get(name) || '';
    },

    set(name, value) {
      if (!this.initialized && !this.init()) return false;
      return !!api.set(name, String(value));
    },

    save() {
      if (!this.initialized && !this.init()) return false;
      return !!api.save();
    },

    getLocation() {
      return this.get(fields.location);
    },

    setLocation(value) {
      return this.set(fields.location, value);
    },

    getSuspendData() {
      return this.get(fields.suspendData);
    },

    setSuspendData(value) {
      return this.set(fields.suspendData, value);
    },

    setScore(raw, min = 0, max = 100) {
      if (!this.initialized && !this.init()) return false;
      const a = api.set(fields.scoreRaw, String(raw));
      const b = api.set(fields.scoreMin, String(min));
      const c = api.set(fields.scoreMax, String(max));
      return !!(a && b && c);
    },

    complete() {
      if (!this.initialized && !this.init()) return false;
      const ok = api.set(fields.completion, 'completed');
      return !!ok && !!api.save();
    },

    pass() {
      if (!this.initialized && !this.init()) return false;

      if (api.version === '2004') {
        const a = api.set(fields.completion, 'completed');
        const b = api.set(fields.success, 'passed');
        return !!(a && b && api.save());
      }

      const ok = api.set(fields.completion, 'passed');
      return !!ok && !!api.save();
    },

    fail() {
      if (!this.initialized && !this.init()) return false;

      if (api.version === '2004') {
        const a = api.set(fields.completion, 'completed');
        const b = api.set(fields.success, 'failed');
        return !!(a && b && api.save());
      }

      const ok = api.set(fields.completion, 'failed');
      return !!ok && !!api.save();
    },

    finish() {
      if (!this.initialized && !this.init()) return false;
      this.setLocation(location.pathname + location.search + location.hash);
      this.save();
      const ok = api.quit();
      this.initialized = false;
      return !!ok;
    },

    completeAndFinish() {
      const a = this.complete();
      const b = this.finish();
      return !!(a && b);
    }
  };

  window.CourseSCORM = CourseSCORM;

  if (config.autoInitialize !== false) {
    window.addEventListener('load', function () {
      CourseSCORM.init();
    }, { once: true });
  }

  window.addEventListener('pagehide', function () {
    if (!CourseSCORM.initialized) return;
    CourseSCORM.setLocation(location.pathname + location.search + location.hash);
    CourseSCORM.save();
  });
})();`;
}

function buildManifest({ courseTitle, courseId, launchFile, allFiles }) {
  const fileNodes = allFiles
    .filter((file) => file !== 'imsmanifest.xml')
    .map((file) => `      <file href="${escapeXml(file)}" />`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest
  identifier="${escapeXml(courseId)}"
  version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="
    http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
    http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>

  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${escapeXml(courseTitle)}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
        <title>${escapeXml(courseTitle)}</title>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource
      identifier="RES-1"
      type="webcontent"
      adlcp:scormtype="sco"
      href="${escapeXml(launchFile)}">
${fileNodes}
    </resource>
  </resources>
</manifest>`;
}
async function injectIntoHtml(htmlFile) {
  const prefix = getPrefixForHtml(htmlFile);

  const snippet = [
    `<script>window.__SCORM_CONFIG__ = { version: ${JSON.stringify(config.scormVersion)}, autoInitialize: true };</script>`,
    `<script src="${prefix}scorm/SCORM_API_wrapper.js"></script>`,
    `<script src="${prefix}scorm/scorm-adapter.js"></script>`
  ].join('\n');

  let html = await fs.readFile(htmlFile, 'utf8');

  // Rewrite root-relative links like /_astro/... and /images/...
  html = rewriteRootRelativeUrls(html, prefix);

  if (!html.includes('SCORM_API_wrapper.js')) {
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${snippet}\n</head>`);
    } else {
      html = `${snippet}\n${html}`;
    }
  }

  await fs.writeFile(htmlFile, html, 'utf8');
}

async function main() {
  if (!(await exists(distDir))) {
    throw new Error('dist folder not found. Run npm run build first.');
  }

  if (!(await exists(wrapperSource))) {
    throw new Error(
      'Missing scripts/vendor/SCORM_API_wrapper.js. Download the official pipwerks wrapper JS file and place it there.'
    );
  }

  await fs.mkdir(scormDir, { recursive: true });

  await fs.copyFile(wrapperSource, path.join(scormDir, 'SCORM_API_wrapper.js'));
  await fs.writeFile(path.join(scormDir, 'scorm-adapter.js'), buildAdapterScript(), 'utf8');

  const absoluteFiles = await walk(distDir);
  const relativeFiles = absoluteFiles.map((file) =>
    toPosix(path.relative(distDir, file))
  );

  for (const file of absoluteFiles) {
    if (file.toLowerCase().endsWith('.html')) {
      await injectIntoHtml(file);
    }
  }

  const manifest = buildManifest({
    courseTitle: config.courseTitle,
    courseId: config.courseId,
    launchFile: config.launchFile,
    allFiles: relativeFiles
  });

  await fs.writeFile(path.join(distDir, 'imsmanifest.xml'), manifest, 'utf8');

  console.log('SCORM wrapper injected.');
  console.log('Manifest written to dist/imsmanifest.xml');
  console.log('Package the contents of dist/ as a ZIP for LMS upload.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});