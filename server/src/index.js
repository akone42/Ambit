/**
 * EXPRESS ENTRY POINT
 *
 * This file imports the configured Express app and starts the HTTP server.
 */

import 'dotenv/config'
import app from './app.js'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`)
})
