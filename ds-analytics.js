/*
 * ds-analytics - GA4 measurement and conversion tracking for Digitally Shifted sites.
 *
 * Zero dependencies. Load this file in every page. Call DSAnalytics.init once.
 * The module sends events to the GA4 data stream. It also exposes manual
 * tracking methods for single-page application flows.
 *
 * Event contract (see docs/analytics-setup.md):
 *   contact_form_submit  - visitor submits the contact form
 *   quote_request        - visitor submits the quote request form
 *   call_click           - visitor clicks a tel: link
 *   whatsapp_click       - visitor clicks a WhatsApp link
 *   generate_lead        - GA4 recommended lead event, sent after each form lead
 */
(function () {
  'use strict';

  var WA_SELECTORS = 'a[href*="wa.me/"], a[href*="api.whatsapp.com"]';
  var TEL_SELECTOR = 'a[href^="tel:"]';

  function validMeasurementId(id) {
    return typeof id === 'string' && /^G-[A-Z0-9]{6,12}$/.test(id);
  }

  function DSAnalytics() {
    this.measurementId = null;
    this.debug = false;
    this.ready = false;
    this.log = [];
  }

  DSAnalytics.prototype = {
    /*
     * Start measurement. Options:
     *   measurementId    - GA4 web stream measurement ID, format G-XXXXXXXXXX.
     *   analyticsConsent - 'granted' (default) or 'denied'. Sets the default
     *                      consent for analytics_storage.
     *   debug            - true logs each hit to the console.
     *   stub             - true skips the gtag.js script load. Use in tests.
     */
    init: function (options) {
      options = options || {};
      var id = options.measurementId;
      if (!validMeasurementId(id)) {
        throw new Error('ds-analytics: measurementId must match G-XXXXXXXXXX');
      }
      this.measurementId = id;
      this.debug = options.debug === true;

      var w = typeof window !== 'undefined' ? window : undefined;
      if (!w) { return this; }
      w.dataLayer = w.dataLayer || [];

      var self = this;
      function gtag() {
        w.dataLayer.push(arguments);
        self._record(arguments);
      }
      this._gtag = gtag;
      w.gtag = w.gtag || gtag;

      // Consent Mode v2 defaults. Ads stay denied until the site adds a
      // consent banner. Analytics follows analyticsConsent.
      gtag('consent', 'default', {
        analytics_storage: options.analyticsConsent === 'denied' ? 'denied' : 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      gtag('js', new Date());
      if (options.debugMode === true) {
        gtag('config', id, { debug_mode: true });
      } else {
        gtag('config', id);
      }

      if (options.stub !== true) {
        this._loadScript();
      }
      this._bindAutoEvents();
      this.ready = true;
      return this;
    },

    _loadScript: function () {
      var doc = typeof document !== 'undefined' ? document : undefined;
      if (!doc || !doc.createElement || doc.__dsNoScript) { return; }
      var script = doc.createElement('script');
      script.async = true;
      script.src = 'https://www.googletagmanager.com/gtag/js?id=' + this.measurementId;
      script.setAttribute('data-ds-ga4', this.measurementId);
      (doc.head || doc.documentElement).appendChild(script);
    },

    _record: function (args) {
      var entry = [];
      for (var i = 0; i < args.length; i += 1) { entry.push(args[i]); }
      this.log.push(entry);
      if (this.debug && typeof console !== 'undefined' && console.info) {
        console.info('[ds-analytics]', entry);
      }
      var w = typeof window !== 'undefined' ? window : undefined;
      if (w && w.__DS_EVENTS) { w.__DS_EVENTS.push(entry); }
    },

    _send: function (name, params) {
      if (!this.ready || !this._gtag) { return; }
      this._gtag('event', name, params || {});
    },

    /* Bind click and submit delegation once. Safe to call again. */
    _bindAutoEvents: function () {
      if (this._bound) { return; }
      var doc = typeof document !== 'undefined' ? document : undefined;
      if (!doc || !doc.addEventListener) { return; }
      var self = this;
      doc.addEventListener('click', function (event) {
        self._onClick(event);
      });
      doc.addEventListener('submit', function (event) {
        self._onSubmit(event);
      });
      this._bound = true;
    },

    _onClick: function (event) {
      var target = event && event.target;
      if (!target || !target.closest) { return; }
      var wa = target.closest(WA_SELECTORS);
      if (wa) {
        var href = wa.getAttribute ? wa.getAttribute('href') : wa.href;
        this.whatsappClick({ linkUrl: href, location: locationLabel(wa) });
        return;
      }
      var tel = target.closest(TEL_SELECTOR);
      if (tel) {
        var raw = tel.getAttribute ? tel.getAttribute('href') : tel.href;
        var phone = typeof raw === 'string' && raw.indexOf('tel:') === 0 ? raw.slice(4) : raw;
        this.callClick({ phoneNumber: phone, location: locationLabel(tel) });
      }
    },

    _onSubmit: function (event) {
      var form = event && event.target;
      if (!form || !form.getAttribute || form.__dsFired) { return; }
      var kind = form.getAttribute('data-ds-form');
      if (kind === 'contact') {
        form.__dsFired = true;
        this.contactSubmit({ formLocation: locationLabel(form) });
      } else if (kind === 'quote') {
        form.__dsFired = true;
        this.quoteRequest({ formLocation: locationLabel(form) });
      }
    },

    /* Manual tracking methods for SPA flows and thank-you states. */

    contactSubmit: function (params) {
      this._send('contact_form_submit', withDefaults(params));
      this._send('generate_lead', withDefaults({
        form_type: 'contact', form_location: params && params.formLocation
      }));
    },

    quoteRequest: function (params) {
      this._send('quote_request', withDefaults(params));
      this._send('generate_lead', withDefaults({
        form_type: 'quote', form_location: params && params.formLocation
      }));
    },

    callClick: function (params) {
      this._send('call_click', withDefaults(params));
    },

    whatsappClick: function (params) {
      this._send('whatsapp_click', withDefaults(params));
    },

    /* Send a page_view for SPA route changes. */
    pageView: function (path, title) {
      var w = typeof window !== 'undefined' ? window : undefined;
      var loc = w && w.location ? w.location : {};
      var docTitle = typeof document !== 'undefined' && document.title ? document.title : '';
      this._send('page_view', {
        page_location: (loc.origin || '') + (path || loc.pathname || '/'),
        page_title: title || docTitle
      });
    }
  };

  function snakeCase(key) {
    return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  }

  function withDefaults(params) {
    var out = {};
    var key;
    for (key in params) {
      if (Object.prototype.hasOwnProperty.call(params, key) && params[key] !== undefined && params[key] !== null) {
        out[snakeCase(key)] = params[key];
      }
    }
    return out;
  }

  function locationLabel(el) {
    if (!el || !el.getAttribute) { return undefined; }
    return el.getAttribute('data-ds-location') || undefined;
  }

  if (typeof window !== 'undefined') {
    window.DSAnalytics = new DSAnalytics();
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DSAnalytics: DSAnalytics, validMeasurementId: validMeasurementId };
  }
})();
