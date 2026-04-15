(function () {
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
})();