/*jslint indent: 2 */
/*global $ */

var GOVUK = GOVUK || {};

GOVUK.performance = GOVUK.performance || {};

GOVUK.performance.stageprompt = (function () {

    var setup, setupForPiwik, splitAction;

    splitAction = function (action) {
        var parts = action.split(':');
        if (parts.length <= 3) return parts;
        return [parts.shift(), parts.shift(), parts.join(':')];
    };

    setup = function (analyticsCallback) {
        var journeyStage = $('[data-journey]').attr('data-journey'),
            journeyHelpers = $('[data-journey-click]');

        if (journeyStage) {
            analyticsCallback.apply(null, splitAction(journeyStage));
        }

        journeyHelpers.on('click', function (event) {
            analyticsCallback.apply(null, splitAction($(this).data('journey-click')));
        });
    };

    setupForPiwik = function () {
        setup(GOVUK.performance.sendPiwikEvent);
    };

    return {
        setup: setup,
        setupForPiwik: setupForPiwik
    };
}());

GOVUK.performance.sendPiwikEvent = function (category, event, label) {
    _paq.push(['_trackEvent', category, event, label, undefined, true]);
};
