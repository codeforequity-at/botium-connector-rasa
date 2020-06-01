


module.exports = {
  exportHandler: ({ caps, uploadmode, newBotName, newBotAliasName, waitforready, ...rest } = {}, { convos, utterances } = {}, { statusCallback } = {}) => exportIntents({ caps, uploadmode, newBotName, newBotAliasName, waitforready, ...rest }, { convos, utterances }, { statusCallback }),
  exportArgs: {
    caps: {
      describe: 'Capabilities',
      type: 'json',
      skipCli: true
    },
    uploadmode: {
      describe: 'Copy Lex Bot and create new intent version with user examples, or append user examples to existing intents only',
      choices: ['copy', 'append'],
      default: 'copy'
    },
    newBotName: {
      describe: 'New Lex Bot name (if not given will be generated)',
      type: 'string'
    },
    newBotAliasName: {
      describe: 'New Lex Bot alias',
      type: 'string',
      default: 'botiumdev'
    },
    waitforready: {
      describe: 'Wait until Lex Bot is ready',
      type: 'boolean',
      default: false
    }
  }
}
