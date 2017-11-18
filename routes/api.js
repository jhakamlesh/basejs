const express = require('express');
const swagger = require('swagger-express-middleware');
const sui = require('swagger-ui-dist').getAbsoluteFSPath();
const handlers = require('../handlers');
const Boom = require('boom');
const router = express.Router();

// Default api options if not configured
config.api = config.api || {};

// Swagger UI
if (config.api.ui) {
    router.get('/api/ui', (req, res, next) => {
        if (!req.query.url) {
            res.redirect('?url=' + req.protocol + '://' + req.get('host') + '/api/docs');
        } else {
            next();
        }
    });
    router.use('/api/ui', express.static(sui));
}

// Swagger middleware
swagger('routes/api.json', router, (err, middleware) => {
    // Halt on errors
    if (err) {
        logger.error(err.message);
        process.exit(1);
    }

    // Parse and validate
    router.use(
        middleware.metadata(),
        middleware.CORS(),
        middleware.files({ useBasePath: true, apiPath: config.api.docs ? '/docs' : '' }),
        middleware.parseRequest(),
        middleware.validateRequest()
    );

    // Handlers
    router.use('/api', (req, res, next) => {
        // Find handler according to swagger definition
        const handlerName = req.swagger.pathName.slice(1).replace('/', '-');
        const method = req.method.toLowerCase();
        const handler = handlers[handlerName];

        // If handler not found continue to mock and error handling
        if (!handler || !handler[method]) {
            return next();
        }

        // Call handler
        handler[method](req, res, next);
    });

    // Mock
    if (config.api.mock) router.use(middleware.mock());

    // Default handler (not implemented error)
    router.use('/api', (req, res, next) => {
        next(Boom.notImplemented(`${req.method} /api${req.path} is not implemented`));
    });

    // Error handler
    router.use('/api', (err, req, res, next) => {
        const errPayload = Boom.boomify(err, {statusCode: err.status || 500, override: false}).output.payload;
        if (errPayload.statusCode === 500) logger.error(err.stack);
        res.status(errPayload.statusCode).json(errPayload);
    });

    // API is ready
    logger.info('API is ready');
});

module.exports = router;
