/*
 * GET /healthcheck
 */
exports.cookies = function (req, res, next) {
    var msg = 'How cookies are used on the payment service';

    res.status(200);
    res.locals.journeyDescription = 'How cookies are used on the payment service';
    res.locals.pageTitle = msg;

    if (req.accepts('html')) {
        res.render('cookies');
    } else {
        res.send(msg);
    }
};
