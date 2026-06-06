import { startServer } from './app'

startServer()
  .then(({ config }) => {
    // eslint-disable-next-line no-console
    console.log(`VCanvas public server listening on http://${config.host}:${config.port}`)
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exit(1)
  })
