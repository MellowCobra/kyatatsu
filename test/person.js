const kyatatsu = require('../index.js')

let schema = {
    name: {
        required: true
    },
    dob: {
        required: false,
        default: () => new Date()
    },
    sex: {
        required: false
    }
}

kyatatsu.registerModel('Person', schema)
let Person = kyatatsu.model('Person', schema)

Person.createNew = function(opts) {
    return new Promise( (resolve, reject) => {
        let newPerson = {
            name: opts.name,
            dob: opts.dob,
            sex: opts.sex || 'male'
        }

        Person.create(newPerson).then( person => {
            const History = require('./history.js')
            History.create({
                subject: person,
                update: person
            }).then( history => {
                resolve(person)
            }).catch(err => {
                reject(err)
            })
        }).catch(err => {
            reject(err)
        })
    })
}

Person.prototype.update = function(update) {
    return new Promise( (resolve, reject) => {
        Object.assign(this, update)

        this.save().then( person => {
            const History = require('./history.js')
            History.create({
                subject: person,
                update: update
            }).then( history => {
                resolve(person)
            }).catch(err => {
                reject(err)
            }) 
        }).catch(err => {
            reject(err)
        })
    })
}

module.exports = Person