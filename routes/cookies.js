exports.cookies = function (req, res) {

    var msg = 'Cookies';

    res.status(200);
    res.locals.journeyDescription = 'Cookies';
    res.locals.pageTitle = msg;

    if (req.accepts('html')) {
        res.render('cookies');
    } else {
        res.send(msg);
    }
};
