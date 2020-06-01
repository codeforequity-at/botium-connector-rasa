const util = require('util')
const debug = require('debug')('botium-connector-rasa')

const SimpleRestContainer = require('botium-core/src/containers/plugins/SimpleRestContainer')
const CoreCapabilities = require('botium-core/src/Capabilities')

const Capabilities = {
  RASA_MODE: 'RASA_MODE',
  RASA_ENDPOINT_URL: 'RASA_ENDPOINT_URL',
  RASA_ENDPOINT_PING_URL: 'RASA_ENDPOINT_PING_URL',
  RASA_ENDPOINT_TOKEN: 'RASA_ENDPOINT_TOKEN',
  RASA_ENDPOINT_JWT: 'RASA_ENDPOINT_JWT'
}

const Defaults = {
  [Capabilities.RASA_MODE]: 'REST_INPUT'
}

class BotiumConnectorRasa {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
    this.delegateContainer = null
    this.delegateCaps = null
  }

  Validate () {
    debug('Validate called')

    this.caps = Object.assign({}, Defaults, this.caps)

    if (this.caps[Capabilities.RASA_MODE] !== 'REST_INPUT' && this.caps[Capabilities.RASA_MODE] !== 'NLU_INPUT') throw new Error('RASA_MODE capability either REST_INPUT or NLU_INPUT')

    this.delegateCaps = {}

    if (!this.delegateContainer) {
      let endpointPathname = ''
      if (this.caps[Capabilities.RASA_MODE] === 'REST_INPUT') {
        endpointPathname = 'webhooks/rest/webhook'

        Object.assign(this.delegateCaps, {
          [CoreCapabilities.SIMPLEREST_METHOD]: 'POST',
          [CoreCapabilities.SIMPLEREST_BODY_TEMPLATE]: '{ "message": "{{msg.messageText}}", "sender": "{{botium.conversationId}}" }',
          [CoreCapabilities.SIMPLEREST_BODY_JSONPATH]: '$.*',
          [CoreCapabilities.SIMPLEREST_RESPONSE_JSONPATH]: '$.text',
          [CoreCapabilities.SIMPLEREST_MEDIA_JSONPATH]: '$.image',
          [CoreCapabilities.SIMPLEREST_RESPONSE_HOOK]: ({ botMsg, botMsgRoot }) => {
            if (botMsgRoot && botMsgRoot.buttons) {
              botMsg.buttons = botMsgRoot.buttons.map(b => ({ text: b.title, payload: b.payload }))
            }
          }
        })
      } else if (this.caps[Capabilities.RASA_MODE] === 'NLU_INPUT') {
        endpointPathname = 'model/parse'

        Object.assign(this.delegateCaps, {
          [CoreCapabilities.SIMPLEREST_METHOD]: 'POST',
          [CoreCapabilities.SIMPLEREST_BODY_TEMPLATE]: '{ "text": "{{msg.messageText}}" }',
          [CoreCapabilities.SIMPLEREST_RESPONSE_HOOK]: ({ botMsg }) => {
            botMsg.nlp = {
              intent: {
                incomprehension: true
              }
            }
            if (botMsg.sourceData.intent) {
              botMsg.nlp.intent = {
                name: botMsg.sourceData.intent.name,
                confidence: botMsg.sourceData.intent.confidence,
                incomprehension: false
              }
            }
            if (botMsg.sourceData.intent_ranking) {
              botMsg.nlp.intent.intents = botMsg.sourceData.intent_ranking.map(i => ({ name: i.name, confidence: i.confidence }))
            }
            if (botMsg.sourceData.entities) {
              botMsg.nlp.entities = botMsg.sourceData.entities.map(e => ({ name: e.entity, value: e.value, confidence: e.confidence }))
            }
          }
        })
      }

      let url = this.caps[Capabilities.RASA_ENDPOINT_URL]
      if (!url.endsWith('/')) url = url + '/'
      url = url + endpointPathname
      if (this.caps[Capabilities.RASA_ENDPOINT_TOKEN]) {
        url = url + '?token=' + this.caps[Capabilities.RASA_ENDPOINT_TOKEN]
      }
      this.delegateCaps[CoreCapabilities.SIMPLEREST_URL] = url

      if (this.caps[Capabilities.RASA_ENDPOINT_JWT]) {
        this.delegateCaps[CoreCapabilities.SIMPLEREST_HEADERS_TEMPLATE] = {
          Authorization: 'Bearer ' + this.caps[Capabilities.RASA_ENDPOINT_JWT]
        }
      }

      if (this.caps[Capabilities.RASA_ENDPOINT_PING_URL]) {
        this.delegateCaps[CoreCapabilities.SIMPLEREST_PING_URL] = this.caps[Capabilities.RASA_ENDPOINT_PING_URL]
      } else {
        let pingUrl = this.caps[Capabilities.RASA_ENDPOINT_URL]
        if (!pingUrl.endsWith('/')) pingUrl = pingUrl + '/'
        pingUrl = pingUrl + 'version'
        this.delegateCaps[CoreCapabilities.SIMPLEREST_PING_URL] = pingUrl
      }

      this.delegateCaps = Object.assign({}, this.caps, this.delegateCaps)

      debug(`Validate delegateCaps ${util.inspect(this.delegateCaps)}`)
      this.delegateContainer = new SimpleRestContainer({ queueBotSays: this.queueBotSays, caps: this.delegateCaps })
    }

    debug('Validate delegate')
    return this.delegateContainer.Validate && this.delegateContainer.Validate()
  }

  Build () {
    return this.delegateContainer.Build && this.delegateContainer.Build()
  }

  Start () {
    return this.delegateContainer.Start && this.delegateContainer.Start()
  }

  UserSays (msg) {
    debug('UserSays called')
    return this.delegateContainer.UserSays(msg)
  }

  Stop () {
    return this.delegateContainer.Stop && this.delegateContainer.Stop()
  }

  Clean () {
    return this.delegateContainer.Clean && this.delegateContainer.Clean()
  }
}

module.exports = BotiumConnectorRasa
