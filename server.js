// Entry point: creates the Express app and starts the server.
// The logic lives under src/ (config, middleware, routes, services, repositories).
const config = require('./src/config');
const createApp = require('./src/app');

createApp().listen(config.port, config.host, () => {
  console.log(`Servidor en http://${config.host}:${config.port}`);
});
