const BotiumConnectorRasa = require('./src/connector')
const { importRasaIntents } = require('./src/rasaintents')

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorRasa,
  Utils: {
    importRasaIntents
  }
}
