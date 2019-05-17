var util = require('util')
var _ = require('lodash')
const debug = require('debug')('botium-connector-rasa')

const SimpleRestContainer = require('botium-core/src/containers/plugins/SimpleRestContainer')
const CoreCapabilities = require('botium-core/src/Capabilities')

const Capabilities = {
  RASA_MODE: 'RASA_MODE',
  RASA_REST_INPUT_URL: 'RASA_REST_INPUT_URL',
  RASA_REST_INPUT_PING_URL: 'RASA_REST_INPUT_PING_URL'
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

    if (!this.caps[Capabilities.RASA_MODE]) this.caps[Capabilities.RASA_MODE] = 'REST_INPUT'
    switch (this.caps[Capabilities.RASA_MODE]) {
      case 'REST_INPUT':
        if (!this.caps[Capabilities.RASA_REST_INPUT_URL]) throw new Error('RASA_REST_INPUT_URL capability required')
    }

    if (!this.delegateContainer) {
      switch (this.caps[Capabilities.RASA_MODE]) {
        case 'REST_INPUT':
          let pingUrl = this.caps[Capabilities.RASA_REST_INPUT_PING_URL]
          if (_.isUndefined(pingUrl) || _.isNull(pingUrl)) {
            const parsed = new URL(this.caps[Capabilities.RASA_REST_INPUT_URL])
            parsed.pathname = '/version'
            pingUrl = parsed.href
          }
          this.delegateCaps = {
            [CoreCapabilities.SIMPLEREST_URL]: this.caps[Capabilities.RASA_REST_INPUT_URL],
            [CoreCapabilities.SIMPLEREST_PING_URL]: pingUrl,
            [CoreCapabilities.SIMPLEREST_METHOD]: 'POST',
            [CoreCapabilities.SIMPLEREST_BODY_TEMPLATE]: '{ "message": "{{msg.messageText}}", "sender": "{{botium.conversationId}}" }',
            [CoreCapabilities.SIMPLEREST_RESPONSE_JSONPATH]: '$.*.text',
            [CoreCapabilities.SIMPLEREST_MEDIA_JSONPATH]: '$.*.image',
            [CoreCapabilities.SIMPLEREST_BUTTONS_JSONPATH]: '$.*.buttons.*.payload'
          }
          this.delegateContainer = new SimpleRestContainer({ queueBotSays: this.queueBotSays, caps: this.delegateCaps })
          break
        default:
          throw new Error(`Unknown mode ${this.caps[Capabilities.RASA_MODE]}`)
      }

      debug(`Validate delegateCaps ${util.inspect(this.delegateCaps)}`)
    }

    debug(`Validate delegate`)
    this.delegateContainer.Validate()

    // SimpleRestContainer is synch
    return Promise.resolve()
  }

  Build () {
    if (this.delegateContainer.Build) {
      this.delegateContainer.Build()
    }

    debug('Build called')
    return Promise.resolve()
  }

  Start () {
    debug('Start called')

    if (this.delegateContainer.Start) {
      this.delegateContainer.Start()
    }

    return Promise.resolve()
  }

  UserSays (msg) {
    debug('UserSays called')
    return this.delegateContainer.UserSays(msg)
  }

  Stop () {
    debug('Stop called')

    if (this.delegateContainer.Stop) {
      this.delegateContainer.Stop()
    }

    return Promise.resolve()
  }

  Clean () {
    debug('Clean called')
    if (this.delegateContainer.Clean) {
      this.delegateContainer.Clean()
    }

    return Promise.resolve()
  }
}

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorRasa
}
