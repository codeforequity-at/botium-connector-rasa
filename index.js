const BotiumConnectorRasa = require('./src/connector')
const { importHandler, importArgs } = require('./src/import')
const { exportHandler, exportArgs } = require('./src/export')

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorRasa,
  Import: {
    Handler: importHandler,
    Args: importArgs
  },
  Export: {
    Handler: exportHandler,
    Args: exportArgs
  },
  PluginDesc: {
    name: 'Rasa',
    provider: 'Rasa',
    features: {
      intentResolution: true,
      intentConfidenceScore: true,
      alternateIntents: true,
      entityResolution: true,
      entityConfidenceScore: true
    },
    capabilities: [
      {
        name: 'RASA_ENDPOINT_URL',
        label: 'HTTP(S) endpoint URL of your Rasa chatbot host',
        description: 'URL without endpoint path',
        type: 'url',
        required: true
      },
      {
        name: 'RASA_MODE',
        label: 'Rasa Endpoint',
        description: 'Choose between conversational flow testing or NLU testing',
        type: 'choice',
        required: false,
        choices: [
          { key: 'DIALOG_AND_NLU', name: 'Rasa dialogue and NLU engine' },
          { key: 'REST_INPUT', name: 'Rasa Core (dialogue engine only)' },
          { key: 'NLU_INPUT', name: 'Rasa NLU (NLU engine only)' }
        ]
      },
      {
        name: 'RASA_REST_ENDPOINT_PATH',
        label: 'Rest endpoint path',
        description: 'By default it is \'webhooks/rest/webhook\'',
        type: 'string',
        required: false
      },
      {
        name: 'RASA_NLU_ENDPOINT_PATH',
        label: 'NLU endpoint path',
        description: 'By default it is \'model/parse\'',
        type: 'string',
        required: false
      },
      {
        name: 'RASA_ENDPOINT_PING_URL',
        label: 'HTTP(S) endpoint to ping before start',
        type: 'url',
        required: false
      },
      {
        name: 'RASA_ENDPOINT_TOKEN',
        label: 'Token for Token Authentication',
        type: 'secret',
        required: false
      },
      {
        name: 'RASA_ENDPOINT_JWT',
        label: 'JWT Token for JWT Authentication',
        type: 'secret',
        required: false
      }
    ]
  }
}
