const util = require('util')
const _ = require('lodash')
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
  [Capabilities.RASA_MODE]: 'DIALOG_AND_NLU'
}

class BotiumConnectorRasa {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
    this.delegateContainers = []
    this.queueListener = null
  }

  Validate () {
    debug('Validate called')

    this.caps = Object.assign({}, Defaults, this.caps)

    if (!this.caps[Capabilities.RASA_ENDPOINT_URL]) throw new Error('RASA_ENDPOINT_URL capability is required')
    if (this.caps[Capabilities.RASA_MODE] !== 'DIALOG_AND_NLU' && this.caps[Capabilities.RASA_MODE] !== 'REST_INPUT' && this.caps[Capabilities.RASA_MODE] !== 'NLU_INPUT') throw new Error('RASA_MODE capability either DIALOG_AND_NLU, REST_INPUT or NLU_INPUT')

    this.delegateContainers = []

    const getRasaUrl = (endpointPathName) => {
      let url = this.caps[Capabilities.RASA_ENDPOINT_URL]
      if (!url.endsWith('/')) url = url + '/'
      url = url + endpointPathName
      if (this.caps[Capabilities.RASA_ENDPOINT_TOKEN]) {
        url = url + '?token=' + this.caps[Capabilities.RASA_ENDPOINT_TOKEN]
      }
      return url
    }

    if (this.caps[Capabilities.RASA_MODE] === 'DIALOG_AND_NLU' || this.caps[Capabilities.RASA_MODE] === 'REST_INPUT') {
      const delegateCaps = {}

      Object.assign(delegateCaps, {
        [CoreCapabilities.SIMPLEREST_URL]: getRasaUrl('webhooks/rest/webhook'),
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
      if (this.caps[Capabilities.RASA_ENDPOINT_PING_URL]) {
        delegateCaps[CoreCapabilities.SIMPLEREST_PING_URL] = this.caps[Capabilities.RASA_ENDPOINT_PING_URL]
      } else {
        delegateCaps[CoreCapabilities.SIMPLEREST_PING_URL] = getRasaUrl('version')
      }
      if (this.caps[Capabilities.RASA_ENDPOINT_JWT]) {
        delegateCaps[CoreCapabilities.SIMPLEREST_HEADERS_TEMPLATE] = {
          Authorization: 'Bearer ' + this.caps[Capabilities.RASA_ENDPOINT_JWT]
        }
      }
      const allCaps = Object.assign({}, this.caps, delegateCaps)
      debug(`Validate REST_INPUT delegateCaps ${util.inspect(delegateCaps)}`)
      this.delegateContainers.push(new SimpleRestContainer({ queueBotSays: (botMsg) => this.queueListener && this.queueListener(botMsg), caps: allCaps }))

    }
    if (this.caps[Capabilities.RASA_MODE] === 'DIALOG_AND_NLU' || this.caps[Capabilities.RASA_MODE] === 'NLU_INPUT') {
      const delegateCaps = {}

      Object.assign(delegateCaps, {
        [CoreCapabilities.SIMPLEREST_URL]: getRasaUrl('model/parse'),
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
            if (!botMsg.nlp.intent) {
              botMsg.nlp.intent = { incomprehension: true }
            } else if (!botMsg.nlp.intent.name || botMsg.nlp.intent.name.toLowerCase() === 'none') {
              botMsg.nlp.intent.incomprehension = true
            }
          if (botMsg.sourceData.intent_ranking) {
            botMsg.nlp.intent.intents = botMsg.sourceData.intent_ranking.map(i => ({ name: i.name, confidence: i.confidence }))
          }
          if (botMsg.sourceData.entities) {
            botMsg.nlp.entities = botMsg.sourceData.entities.map(e => ({ name: e.entity, value: e.value, confidence: e.confidence }))
          if (botMsg.sourceData.intent_ranking) {
            botMsg.nlp.intent.intents = botMsg.sourceData.intent_ranking.map(i => ({ name: i.name, confidence: i.confidence }))
          }
          if (botMsg.sourceData.entities) {
            botMsg.nlp.entities = botMsg.sourceData.entities.map(e => ({ name: e.entity, value: e.value, confidence: e.confidence }))
          }
        }
      })
      if (this.caps[Capabilities.RASA_ENDPOINT_JWT]) {
        delegateCaps[CoreCapabilities.SIMPLEREST_HEADERS_TEMPLATE] = {
          Authorization: 'Bearer ' + this.caps[Capabilities.RASA_ENDPOINT_JWT]
        }
      }

      const allCaps = Object.assign({}, this.caps, delegateCaps)
      debug(`Validate NLU_INPUT delegateCaps ${util.inspect(delegateCaps)}`)
      this.delegateContainers.push(new SimpleRestContainer({ queueBotSays: (botMsg) => this.queueListener && this.queueListener(botMsg), caps: allCaps }))
    }
    return Promise.all(this.delegateContainers.map(dc => dc.Validate && dc.Validate()))
  }

  Build () {
    return Promise.all(this.delegateContainers.map(dc => dc.Build && dc.Build()))
  }

  Start () {
    return Promise.all(this.delegateContainers.map(dc => dc.Start && dc.Start()))
  }

  async UserSays (msg) {
    debug('UserSays called')

    const botMsgs = []
    for (const delegateContainer of this.delegateContainers) {
      const botMsg = await this._waitForResponse(delegateContainer, msg)
      if (_.isError(botMsg)) throw botMsg
      else botMsgs.push(botMsg)
    }
    setImmediate(() => {
      if (botMsgs.length === 1) {
        return this.queueBotSays(botMsgs[0])
      }

      debug(`UserSays combinding ${botMsgs.length} Rasa responses (Dialogue and NLU engine)`)
      const botMsgCombined = { sourceData: [] }
      for (const botMsg of botMsgs) {
        if (botMsg.messageText) {
          botMsgCombined.messageText = botMsg.messageText
        }
        if (botMsg.buttons) {
          botMsgCombined.buttons = botMsg.buttons
        }
        if (botMsg.sourceData) {
          if (_.isArray(botMsg.sourceData)) {
            botMsgCombined.sourceData = botMsgCombined.sourceData.concat(botMsg.sourceData)
          } else {
            botMsgCombined.sourceData.push(botMsg.sourceData)
          }
        }
        if (botMsg.nlp) {
          botMsgCombined.nlp = botMsg.nlp
        }
      }
      this.queueBotSays(botMsgCombined)
    })
  }

  Stop () {
    return Promise.all(this.delegateContainers.map(dc => dc.Stop && dc.Stop()))
  }

  Clean () {
    return Promise.all(this.delegateContainers.map(dc => dc.Clean && dc.Clean()))
  }

  async _waitForResponse (delegateContainer, msg) {
    return new Promise((resolve, reject) => {
      this.queueListener = (botMsg) => {
        this.queueListener = null
        resolve(botMsg)
      }
      delegateContainer.UserSays(msg).catch(reject)
    })
  }
}

module.exports = BotiumConnectorRasa
