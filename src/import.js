const path = require('path')
const fs = require('fs')
const slug = require('slug')
const _ = require('lodash')
const md = require('markdown').markdown

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

const importIntents = async ({ nlufile, nlucontent, buildconvos, buildentities }) => {
  if (nlufile) {
    if (!fs.existsSync(nlufile)) {
      throw new Error(`File ${nlufile} not readable`)
    }
    if (path.extname(nlufile) !== '.md') {
      throw new Error(`Only markdown files (*.md) supported (${nlufile})`)
    }
    nlucontent = fs.readFileSync(nlufile, 'utf8')
  }
  const nluData = md.parse(nlucontent)

  const convos = []
  const utterances = []

  let mainPointer = 0
  while (true) {
    if (mainPointer >= nluData.length) break

    if (nluData[mainPointer][0] === 'header') {
      if (nluData[mainPointer][1].level === 2 && nluData[mainPointer][2].startsWith('intent:')) {
        const intentName = getPlainUtterance(nluData[mainPointer].slice(2)).split(':')[1]
        const utterancesRef = intentName
        const inputUtterances = []

        mainPointer++
        if (nluData[mainPointer][0] === 'bulletlist') {
          for (const uttItem of nluData[mainPointer].slice(1).filter(u => u[0] === 'listitem')) {
            const utt = getPlainUtterance(uttItem.slice(1))
            inputUtterances.push(utt)

            if (buildentities) {
              const entityAsserters = getEntityAsserters(uttItem.slice(1))
              if (entityAsserters && entityAsserters.length > 0) {
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
                      ].concat(entityAsserters)
                    }
                  ]
                }
                convos.push(convo)
              }
            }
          }
        }

        if (buildconvos) {
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

        utterances.push({
          name: utterancesRef,
          utterances: inputUtterances
        })
        continue
      }
    }
    mainPointer++
  }

  return { convos, utterances }
}

module.exports = {
  importHandler: ({ nlufile, nlucontent, buildconvos, buildentities, ...rest } = {}) => importIntents({ nlufile, nlucontent, buildconvos, buildentities, ...rest }),
  importArgs: {
    nlufile: {
      describe: 'Specify the path to the nlu.md file of your Rasa model',
      type: 'string',
      required: false
    },
    nlucontent: {
      describe: 'Rasa model file content',
      type: 'string',
      required: false,
      skipCli: true
    },
    buildconvos: {
      describe: 'Build convo files with intent asserters',
      type: 'boolean',
      default: true
    },
    buildentities: {
      describe: 'Add entity asserters to convo files',
      type: 'boolean',
      default: false
    }
  }
}
