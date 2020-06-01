const debug = require('debug')('botium-connector-rasa-export')

const exportIntents = async (args, { convos, utterances }, { statusCallback }) => {
  const status = (log, obj) => {
    debug(log, obj)
    if (statusCallback) statusCallback(log, obj)
  }
  const lines = []
  for (const utt of utterances) {
    lines.push(`## intent:${utt.name}`)
    for (const ue of utt.utterances) {
      lines.push(`- ${ue}`)
    }
    lines.push('')
  }
  const nlucontent = lines.join('\r\n')
  status(`Rasa Training Data ready (${lines.length} lines)`, { nlucontent })

  return { nlucontent }
}

module.exports = {
  exportHandler: ({ ...rest } = {}, { convos, utterances } = {}, { statusCallback } = {}) => exportIntents({ ...rest }, { convos, utterances }, { statusCallback }),
  exportArgs: {
  }
}
