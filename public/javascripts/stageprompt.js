/*jslint indent: 2 */
/*global $ */

var GOVUK = GOVUK || {};

GOVUK.performance = GOVUK.performance || {};

GOVUK.performance.stageprompt = (function () {
  var setup;

  setup = function (analyticsCallback) {
    var journeyStage = $('[data-journey]').attr('data-journey');
    if (journeyStage) {
      analyticsCallback(journeyStage);
    }
  };

  return {
    setup: setup
  };
}());

$(function () {
  GOVUK.performance.stageprompt.setup(function (journeyStage) {
    /*_gaq.push(['_trackEvent', journeyStage , 'n/a', undefined, undefined, true]);*/
    _paq.push(['trackEvent', journeyStage, 'n/a', undefined, undefined]);
  })
});
