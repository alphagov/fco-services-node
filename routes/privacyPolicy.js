exports.privacyPolicy = function (req, res) {

    var msg = 'Privacy policy';

    res.status(200);
    res.locals.journeyDescription = 'Privacy policy';
    res.locals.pageTitle = msg;

    if (req.accepts('html')) {
        res.render('privacyPolicy');
    } else {
        res.send(msg);
    }
};
