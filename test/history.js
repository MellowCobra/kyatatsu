const kyatatsu = require('../index.js')

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

kyatatsu.registerModel('History', schema)
let History = kyatatsu.model('History', schema)

module.exports = History