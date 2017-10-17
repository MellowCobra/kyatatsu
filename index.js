//  Author: Grayson M. Dubois (@MellowCobra)
'use strict'

const couchbase = require('couchbase')
const N1qlQuery = couchbase.N1qlQuery
const uuid = require('uuid/v4')

class ClayShaper {
    constructor(opts){
        opts = opts || {}

        // Set properties from opts
        this.couchbaseUrl = opts.couchbaseUrl || 'couchbase://127.0.0.1'
        this.bucketName   = opts.bucketName   || 'default'

        // Init utilities
        this.cluster = {}
        this.bucket = {}
        // this.openBucket()

        // Will contain all the models that we have
        this.models = {}

        this.errors = {
            noQueryResults: this._NoQueryResultsError,
            modelNotRegistered: this._ModelNotRegisteredError,
            missingProperty: this._MissingPropertyError
        }
    }

    openBucket() {
        this.cluster = new couchbase.Cluster(this.couchbaseUrl)
        this.bucket = this.cluster.openBucket(this.bucketName)
    }

    registerModel(name, schema) {
        this.models[name] = schema
    }

    model(name) {
        let shaper = this
        let schema = this.models[name]
        if (schema == null) throw shaper.errors.modelNotRegistered(name)

        // Return an object constructor for a model
        let model = function(opts) {
            opts = opts || {}

            // Copy the keys into 'this' instance
            // If key has a default property, call it to assign the value to the key
            for (let key in schema) {
                if (schema[key].default) {
                    this[key] = schema[key].default()
                } else if (schema[key].required) {
                    if (opts[key] != null) {
                        this[key] = opts[key]
                    } else {
                        throw shaper.errors.missingProperty(name, key)
                    }
                }
            }

            if (opts._id) this._id = opts._id
            if (opts._type) this._type = opts._type

            this.save = function() {
                return new Promise( (resolve, reject) => {
                    console.log("Saving...")
                    if (this._id == null) this._id = uuid()
                    if (this._type == null) this._type = name
                    let keyspaceRef = `${this._type}:${this._id}`

                    let update = {
                        _id: this._id,
                        _type: this._type
                    }

                    for (let key in schema) {
                        // If this property is a reference
                        if (schema[key].type && schema[key].type === 'ref') {
                            update[key] = {
                                '$ref': this[key]._id,
                                'type': this[key]._type
                            }
                        } else if (schema[key].required === true) {
                            if (this[key] == null) throw shaper.errors.missingProperty(name, key)
                            update[key] = this[key]
                        } else if (this[key] != null) {
                            update[key] = this[key]
                        }
                    }

                    console.log(update)

                    shaper.bucket.upsert(keyspaceRef, update, (err, res) => {
                        if (err) reject(err)
                        shaper.bucket.get(keyspaceRef,(err, res) => {
                            if (err) reject(err)
                            resolve(res.value)
                        })
                    })
                })
            }
        }

        model.create = function(opts) {
            return new Promise( (resolve, reject) => {
                let newModel = {}
                
                for (let key in schema) {
                    if (schema[key].default) {
                        newModel[key] = schema[key].default()
                    } else if (schema[key].required) {
                        if (schema[key].type != null && schema[key].type === 'ref') {
                            newModel[key] = {
                                '$ref': opts[key]._id,
                                'type': opts[key]._type
                            } 
                        } else if (opts[key] != null) {
                            newModel[key] = opts[key]
                        } else {
                            throw shaper.errors.missingProperty(name, key)
                        }
                    }
                }

                let id = uuid()
                newModel._id = id
                newModel._type = name

                let keyspaceRef = `${name}:${id}`

                shaper.bucket.upsert(keyspaceRef, newModel, (err, res) => {
                    if (err) reject(err)
                    
                    shaper.bucket.get(keyspaceRef, (err, res) => {
                        if (err) reject(err)
                        resolve(res.value)
                    })
                })
            })
        }

        return model
    }

    query(queryString, params, modelName) {
        return new Promise( (resolve, reject) => {
            let query = N1qlQuery.fromString(queryString)
            this.bucket.query(query, params, (err, rows) => {
                if (err) reject(err)
                else if (rows == null || rows.length === 0) {
                    resolve(this._NoQueryResultsError(queryString))
                } else {
                    if (modelName != null) {
                        try {
                            let result = new this.model(modelName)(rows[0][Object.keys(rows[0])[0]])
                            resolve(result)
                        } catch (err) {
                            reject (err)
                        }
                    } else {
                        resolve(rows)
                    }
                }
            })
        })
    }

    // Custom Errors
    _NoQueryResultsError(query) {
        let message = `No document results for query ${query}`
        return new Error(message)
    }

    _ModelNotRegisteredError(modelName) {
        let message = `No model registered with name: ${modelName}`
        return new Error(message)
    }

    _MissingPropertyError(name, key) {
        let message = `While instantiating model ${name}: Missing required property ${key}`
        return new Error(message)
    }
}

module.exports = new ClayShaper()