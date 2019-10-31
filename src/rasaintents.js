const util = require('util')
const path = require('path')
const fs = require('fs')
const slug = require('slug')
const _ = require('lodash')
const yargsCmd = require('yargs')
const md = require('markdown').markdown
const { BotDriver, Capabilities } = require('botium-core')
const debug = require('debug')('botium-connector-rasa-intents')
const helpers = require('./helpers')

const getCaps = (caps) => {
  const result = caps || {}
  result[Capabilities.CONTAINERMODE] = 'echo'
  return result
}

const getEntityAsserters = (uttArray) => {
  const entities = {}

  uttArray.filter(u => _.isArray(u) && u[0] === 'link').forEach(u => {
    const href = u[1].href
    let entityName = href
    let entityValue = u[2]

    if (href.split(':').length === 2) {
      entityName = href.split(':')[0]
      entityValue = href.split(':')[1]
    }
    entities[entityName] = entities[entityName] || []
    entities[entityName].push(entityValue)
  })
  if (Object.keys(entities).length === 0) return []

  const result = []
  result.push({
    name: 'ENTITIES',
    args: Object.keys(entities).concat('...')
  })
  result.push({
    name: 'ENTITY_VALUES',
    args: Object.keys(entities).reduce((agg, e) => agg.concat(entities[e]), []).concat('...')
  })
  return result
}

const getPlainUtterance = (uttArray) => {
  return uttArray.map(u => {
    if (_.isString(u)) return u
    if (_.isArray(u)) {
      if (u[0] === 'link') {
        return u[2]
      }
      if (u[0] === 'em') {
        return `_${u[1]}_`
      }
    }
    return ''
  }).join('')
}

const importRasaIntents = async ({ caps, nlufile, buildconvos, buildentities }) => {
  if (!fs.existsSync(nlufile)) {
    throw new Error(`File ${nlufile} not readable`)
  }
  if (path.extname(nlufile) !== '.md') {
    throw new Error(`Only markdown files (*.md) supported (${nlufile})`)
  }

  const nluMd = fs.readFileSync(nlufile, 'utf8')
  const nluData = md.parse(nluMd)

  const convos = []
  const utterances = []

  let mainPointer = 0
  while (true) {
    if (mainPointer >= nluData.length) break

    if (nluData[mainPointer][0] === 'header') {
      if (nluData[mainPointer][1].level === 2 && nluData[mainPointer][2].startsWith('intent:')) {
        const intentName = getPlainUtterance(nluData[mainPointer].slice(2)).split(':')[1]
        const utterancesRef = `UTT_${slug(intentName).toUpperCase()}`
        const inputUtterances = []

        mainPointer++
        if (nluData[mainPointer][0] === 'bulletlist') {
          for (const uttItem of nluData[mainPointer].slice(1).filter(u => u[0] === 'listitem')) {
            const utt = getPlainUtterance(uttItem.slice(1))
            if (buildentities) {
              const convo = {
                header: {
                  name: intentName + '_' + slug(utt)
                },
                conversation: [
                  {
                    sender: 'me',
                    messageText: utt
                  },
                  {
                    sender: 'bot',
                    asserters: [
                      {
                        name: 'INTENT',
                        args: [intentName]
                      }
                    ].concat(getEntityAsserters(uttItem.slice(1)))
                  }
                ]
              }
              convos.push(convo)
            } else {
              inputUtterances.push(utt)
            }
          }
        }

        if (!buildentities && buildconvos) {
          const convo = {
            header: {
              name: intentName
            },
            conversation: [
              {
                sender: 'me',
                messageText: utterancesRef
              },
              {
                sender: 'bot',
                asserters: [
                  {
                    name: 'INTENT',
                    args: [intentName]
                  }
                ]
              }
            ]
          }
          convos.push(convo)
        }

        if (!buildentities) {
          utterances.push({
            name: utterancesRef,
            utterances: inputUtterances
          })
        }
        continue
      }
    }
    mainPointer++
  }

  const driver = new BotDriver(getCaps(caps))
  const container = await driver.Build()
  const compiler = await driver.BuildCompiler()
  return { convos, utterances, driver, container, compiler }
}

const handler = (argv) => {
  debug(`command options: ${util.inspect(argv)}`)

  if (!argv.nlufile) {
    return yargsCmd.showHelp()
  }
  const outputDir = (argv.convos && argv.convos[0]) || './spec/convo'

  importRasaIntents(argv)
    .then(({ convos, utterances, compiler }) => {
      convos && convos.forEach(convo => {
        try {
          const filename = helpers.writeConvo(compiler, convo, outputDir)
          console.log(`SUCCESS: wrote convo to file ${filename}`)
        } catch (err) {
          console.log(`WARNING: writing convo "${convo.header.name}" failed: ${util.inspect(err)}`)
        }
      })
      utterances && utterances.forEach(utterance => {
        try {
          const filename = helpers.writeUtterances(compiler, utterance.name, utterance.utterances, outputDir)
          console.log(`SUCCESS: wrote utterances to file ${filename}`)
        } catch (err) {
          console.log(`WARNING: writing utterances "${utterance.name}" failed: ${util.inspect(err)}`)
        }
      })
    })
    .catch((err) => {
      console.log(err)
      console.log(`FAILED: ${err.message}`)
    })
}

module.exports = {
  importRasaIntents: (args) => importRasaIntents(args),
  args: {
    command: 'rasaimport [nlufile]',
    describe: 'Importing conversations for Botium',
    builder: (yargs) => {
      yargs.positional('nlufile', {
        describe: 'Specify the path to the nlu.md file of your Rasa model'
      })
      yargs.option('buildconvos', {
        describe: 'Build convo files for intent assertions (otherwise, just write utterances files) - use --no-buildconvos to disable',
        default: true
      })
      yargs.option('buildentities', {
        describe: 'Include entities in convo files for assertions - use --no-buildentities to disable',
        default: true
      })
    },
    handler
  }
}
