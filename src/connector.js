const util = require('util')
const _ = require('lodash')
const debug = require('debug')('botium-connector-rasa')

const { Capabilities: CoreCapabilities, Lib: { SimpleRestContainer } } = require('botium-core')

const Capabilities = {
  RASA_MODE: 'RASA_MODE',
  RASA_ENDPOINT_URL: 'RASA_ENDPOINT_URL',
  RASA_REST_ENDPOINT_PATH: 'RASA_REST_ENDPOINT_PATH',
  RASA_NLU_ENDPOINT_PATH: 'RASA_NLU_ENDPOINT_PATH',
  RASA_ENDPOINT_PING_URL: 'RASA_ENDPOINT_PING_URL',
  RASA_ENDPOINT_TOKEN: 'RASA_ENDPOINT_TOKEN',
  RASA_ENDPOINT_JWT: 'RASA_ENDPOINT_JWT',
  RASA_ENDPOINT_TIMEOUT: 'RASA_ENDPOINT_TIMEOUT'
}

const Defaults = {
  [Capabilities.RASA_MODE]: 'DIALOG_AND_NLU',
  [Capabilities.RASA_ENDPOINT_TIMEOUT]: 10000
}

class BotiumConnectorRasa {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
    this.delegateContainerCore = null
    this.delegateContainerNLU = null
    this.queueListenerCore = null
    this.queueListenerNLU = null
    this.queue = null
  }

  Validate () {
    debug('Validate called')

    this.caps = Object.assign({}, Defaults, this.caps)

    if (!this.caps[Capabilities.RASA_ENDPOINT_URL]) throw new Error('RASA_ENDPOINT_URL capability is required')
    if (this.caps[Capabilities.RASA_MODE] !== 'DIALOG_AND_NLU' && this.caps[Capabilities.RASA_MODE] !== 'REST_INPUT' && this.caps[Capabilities.RASA_MODE] !== 'NLU_INPUT') throw new Error('RASA_MODE capability either DIALOG_AND_NLU, REST_INPUT or NLU_INPUT')

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
        [CoreCapabilities.SIMPLEREST_URL]: getRasaUrl(this.caps[Capabilities.RASA_REST_ENDPOINT_PATH] || 'webhooks/rest/webhook'),
        [CoreCapabilities.SIMPLEREST_TIMEOUT]: this.caps[Capabilities.RASA_ENDPOINT_TIMEOUT],
        [CoreCapabilities.SIMPLEREST_METHOD]: 'POST',
        [CoreCapabilities.SIMPLEREST_BODY_TEMPLATE]: '{ "message": "{{msg.messageText}}", "sender": "{{botium.conversationId}}" }',
        [CoreCapabilities.SIMPLEREST_BODY_JSONPATH]: '$.*',
        [CoreCapabilities.SIMPLEREST_RESPONSE_JSONPATH]: '$.text',
        [CoreCapabilities.SIMPLEREST_MEDIA_JSONPATH]: '$.image',
        [CoreCapabilities.SIMPLEREST_IGNORE_EMPTY]: false,
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
      this.delegateContainerCore = new SimpleRestContainer({ queueBotSays: (botMsg) => this._pushToCoreQueue(botMsg), caps: allCaps })
    }
    if (this.caps[Capabilities.RASA_MODE] === 'DIALOG_AND_NLU' || this.caps[Capabilities.RASA_MODE] === 'NLU_INPUT') {
      const delegateCaps = {}

      Object.assign(delegateCaps, {
        [CoreCapabilities.SIMPLEREST_URL]: getRasaUrl(this.caps[Capabilities.RASA_NLU_ENDPOINT_PATH] || 'model/parse'),
        [CoreCapabilities.SIMPLEREST_TIMEOUT]: this.caps[Capabilities.RASA_ENDPOINT_TIMEOUT],
        [CoreCapabilities.SIMPLEREST_METHOD]: 'POST',
        [CoreCapabilities.SIMPLEREST_BODY_TEMPLATE]: '{ "text": "{{msg.messageText}}" }',
        [CoreCapabilities.SIMPLEREST_IGNORE_EMPTY]: false,
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
      this.delegateContainerNLU = new SimpleRestContainer({ queueBotSays: (botMsg) => this._pushToNLUQueue(botMsg), caps: allCaps })
    }
    return Promise.all([this.delegateContainerCore, this.delegateContainerNLU].map(dc => dc && dc.Validate && dc.Validate()))
  }

  Build () {
    return Promise.all([this.delegateContainerCore, this.delegateContainerNLU].map(dc => dc && dc.Build && dc.Build()))
  }

  Start () {
    return Promise.all([this.delegateContainerCore, this.delegateContainerNLU].map(dc => dc && dc.Start && dc.Start()))
  }

  async UserSays (msg) {
    debug('UserSays called')

    this.queue = null
    this.queueListenerCore = null
    this.queueListenerNLU = null

    if (this.caps[Capabilities.RASA_MODE] === 'REST_INPUT') {
      return this.delegateContainerCore.UserSays(msg)
    } else if (this.caps[Capabilities.RASA_MODE] === 'NLU_INPUT') {
      return this.delegateContainerNLU.UserSays(msg)
    } else if (this.caps[Capabilities.RASA_MODE] === 'DIALOG_AND_NLU') {
      this.queue = []

      const botMsgs = await Promise.all([this._waitForResponseNLU(msg), this._waitForResponseCore(msg)])
      for (const botMsg of botMsgs) {
        if (_.isError(botMsg)) throw botMsg
      }

      setImmediate(() => {
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
        this.queue.forEach(botMsg => setImmediate(() => this.queueBotSays(botMsg)))
        this.queue = null
        this.queueListenerCore = null
        this.queueListenerNLU = null
      })
    }
  }

  Stop () {
    return Promise.all([this.delegateContainerCore, this.delegateContainerNLU].map(dc => dc && dc.Stop && dc.Stop()))
  }

  Clean () {
    return Promise.all([this.delegateContainerCore, this.delegateContainerNLU].map(dc => dc && dc.Clean && dc.Clean()))
  }

  _pushToCoreQueue (botMsg) {
    if (this.queueListenerCore) {
      return this.queueListenerCore(botMsg)
    }
    if (_.isNil(this.queue)) {
      setImmediate(() => this.queueBotSays(botMsg))
    } else {
      this.queue.push(botMsg)
    }
  }

  _pushToNLUQueue (botMsg) {
    if (this.queueListenerNLU) {
      return this.queueListenerNLU(botMsg)
    }
    if (_.isNil(this.queue)) {
      setImmediate(() => this.queueBotSays(botMsg))
    } else {
      this.queue.push(botMsg)
    }
  }

  async _waitForResponseCore (msg) {
    return new Promise((resolve, reject) => {
      this.queueListenerCore = (botMsg) => {
        this.queueListenerCore = null
        resolve(botMsg)
      }
      this.delegateContainerCore.UserSays(msg).catch(reject)
    })
  }

  async _waitForResponseNLU (msg) {
    return new Promise((resolve, reject) => {
      this.queueListenerNLU = (botMsg) => {
        this.queueListenerNLU = null
        resolve(botMsg)
      }
      this.delegateContainerNLU.UserSays(msg).catch(reject)
    })
  }
}

module.exports = BotiumConnectorRasa
