const kyatatsu = require('../index.js')
kyatatsu.couchbaseUrl = 'couchbase://xrdclqdbscis01a.unix.medcity.net,xrdclqdbscis01b.unix.medcity.net,xrdclqdbscis01c.unix.medcity.net,xrdclqdbscis01d.unix.medcity.net?detailed_errcodes=true'
kyatatsu.bucketName = "pipeline_qa"
kyatatsu.clusterPass = "pipeline_qa"
kyatatsu.connect()
  .then(cluster => {
    Person.createNew({
      name: "Grayson",
      dob: new Date("12/20/1994")
    }).then( person => {
        console.log(`AFTER Person.create: ${JSON.stringify(person,null,4)}`)
    
        person = new Person(person)
    
        person.sex = 'male'
        return person.save()
    }).then( person => {
        console.log(`AFTER Person.save: ${JSON.stringify(person,null,4)}`)
    
        person = new Person(person)
        return person.update({
            sex: 'female' // saucy
        })
    }).then( person => {
        console.log(`AFTER person.update: ${JSON.stringify(person,null,4)}`)
    }).catch(err => {
        console.error(err)
    })        
  })

const Person = require('./person.js')
const History = require('./history.js')
