const shaper = require('../index.js')

let schema = {
    subject: {
        required: true,
        type: 'ref'
    },
    date: {
        default: () => new Date()
    },
    update: {
        required: true
    }
}

shaper.registerModel('History', schema)
let History = shaper.model('History', schema)

module.exports = History