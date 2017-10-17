# KYATATSU

A javascript library for managing data models and interfacing with Couchbase buckets.

Kyatatsu: Japanese for footstool. This module is named thus as a lightweight, non ODM replacement for Ottoman.

## Usage

Set up Kyatatsu in you main project script (usually server.js) like so
```javascript
const kyatatsu = require('kyatatsu')
kyatatsu.couchbaseUrl = "couchbase://127.0.0.1"
kyatatsu.bucketName = "my_bucket"
kyatatsu.openBucket()
```

Create your models in their own scripts like so:
```javascript
const kyatatsu = require('kyatatsu')

let schema = {
    name: {
        required: true
    },
    birthday: {
        default: () => new Date()
    }
}

kyatatsu.registerModel('Person', schema)
let Person = kyatatsu.model('Person')

module.exports = Person
```

## Schema properties

Specify properties in a schema by assigning them an object with one of the following properties:
* required: (true or false) indicates whether or not the property is required on all model instances
* default: ( () => {} ) function taking no arguments and returning the default value for that property
* type: ('ref') used to specify if the property is a reference to another model

## Testing

Currently, the test/ directory only has an example of using Kyatatsu for two models (Person and History)
Actual Unit Tests will come later