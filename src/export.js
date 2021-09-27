const debug = require('debug')('botium-connector-rasa-export')

const exportIntents = async ({ format }, { convos, utterances }, { statusCallback }) => {
  const status = (log, obj) => {
    debug(log, obj)
    if (statusCallback) statusCallback(log, obj)
  }
  const lines = []
  if (format === 'md') {
    for (const utt of utterances) {
      lines.push(`## intent:${utt.name}`)
      for (const ue of utt.utterances) {
        lines.push(`- ${ue}`)
      }
      lines.push('')
    }
  } else {
    lines.push('version: "2.0"')
    lines.push('')
    lines.push('nlu:')
    for (const utt of utterances) {
      lines.push(`- intent: ${utt.name}`)
      lines.push('  examples: |')
      for (const ue of utt.utterances) {
        lines.push(`    - ${ue}`)
      }
    }
  }
  const nlucontent = lines.join('\r\n')
  status(`Rasa Training Data ready (${lines.length} lines)`, { nlucontent })
  return { nlucontent }
}

module.exports = {
  exportHandler: ({ format, ...rest } = {}, { convos, utterances } = {}, { statusCallback } = {}) => exportIntents({ format, ...rest }, { convos, utterances }, { statusCallback }),
  exportArgs: {
    format: {
      describe: 'Output file format (yml or md)',
      type: 'string',
      default: 'yml'
    }
  }
}
