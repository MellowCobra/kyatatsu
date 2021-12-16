//  Author: Grayson M. Dubois (@MellowCobra)
'use strict'

const couchbase = require('couchbase')
const uuid = require('uuid/v4')

class Kyatatsu {
    constructor(opts) {
      opts = opts || {}

      // Set properties from opts
      this.couchbaseUrl = opts.couchbaseUrl || 'couchbase://127.0.0.1'
      this.bucketName = opts.bucketName || 'default'
      this.clusterUser = opts.clusterUser || opts.bucketName || ''
      this.clusterPass = opts.clusterPass || ''

      // Init utilities
      this.cluster = null

      // Will contain all the models that we have
      this.models = {}

      this.errors = {
          noQueryResults: this._NoQueryResultsError,
          modelNotRegistered: this._ModelNotRegisteredError,
          missingProperty: this._MissingPropertyError,
      }
    }

    async connect() {
      return new Promise((resolve, reject) => {
        couchbase.connect(this.couchbaseUrl, {
          username: this.clusterUser || this.bucketName || "",
          password: this.clusterPass || ""
        }, (err, cluster) => {
          if (err) return reject(err)

          this.cluster = cluster
          return resolve(cluster)
        })
      })
    }


    registerModel(name, schema) {
      this.models[name] = schema
    }

    model(name) {
        let kyatatsu = this
        let schema = this.models[name]
        if (schema == null) throw kyatatsu.errors.modelNotRegistered(name)

        // Return an object constructor for a model
        let model = function(opts) {
            opts = opts || {}

            // Copy the keys into 'this' instance
            for (let key in schema) {
                if (opts.hasOwnProperty(key)) {
                    this[key] = opts[key]
                } else if (schema[key].default) {
                    if (typeof schema[key].default === 'function') {
                        this[key] = schema[key].default()
                    } else {
                        this[key] = schema[key].default
                    }
                } else if (schema[key].required) {
                    if (opts[key] != null) {
                        this[key] = opts[key]
                    } else {
                        throw kyatatsu.errors.missingProperty(name, key)
                    }
                }
            }

            if (opts._id) this._id = opts._id
            if (opts._type) this._type = opts._type

            this.save = async function(saveOpts) {
                return new Promise((resolve, reject) => {
                    saveOpts = saveOpts || {}

                    if (this._id == null) this._id = uuid()
                    if (this._type == null) this._type = name
                    let keyspaceRef = `${this._type}:${this._id}`

                    let update = {
                        _id: this._id,
                        _type: this._type,
                    }

                    if (saveOpts.debug) {
                        console.log(
                            `pre-update for kyatatsu model:\n${JSON.stringify(
                                this,
                                null,
                                4
                            )}`
                        )
                        console.log(
                            `schema for kyatatsu model:\n${JSON.stringify(
                                schema,
                                null,
                                4
                            )}`
                        )
                    }

                    for (let key in schema) {
                        if (this.hasOwnProperty(key)) {
                            // If I have a value for this property
                            if (
                                this[key] != null &&
                                schema[key].type &&
                                schema[key].type === 'ref'
                            ) {
                                // If property is reference, save as a ref
                                update[key] = {
                                    $ref: this[key]['$ref'] || this[key]._id,
                                    _type: this[key]._type,
                                }
                            } else {
                                // otherwise just copy it onto the update
                                update[key] = this[key]
                            }
                        } else {
                            // If I don't have a value for this property
                            if (schema[key].default) {
                                // If there is a default value specified in the schema, use it
                                if (typeof schema[key].default === 'function') {
                                    update[key] = schema[key].default()
                                } else {
                                    update[key] = schema[key].default
                                }
                            } else if (schema[key].required) {
                                // If the schema states this is required, error
                                throw kyatatsu.errors.missingProperty(name, key)
                            }
                        }
                    }

                    if (saveOpts.debug) {
                        console.log(
                            `update for kyatatsu model:\n${JSON.stringify(
                                update,
                                null,
                                4
                            )}`
                        )
                    }

                    let upsertOpts = {
                        persist_to: saveOpts.persistToDisc === true ? 1 : 0,
                    }

                    const collection = kyatatsu.cluster.bucket(kyatatsu.bucketName).collection()

                    collection.upsert(
                        keyspaceRef,
                        update,
                        upsertOpts,
                        (err, res) => {
                            if (err) reject(err)
                            collection.get(keyspaceRef, (err, res) => {
                                if (err) reject(err)
                                resolve(res.value)
                            })
                        }
                    )
                })
            }
        }

        model.create = function(opts, createOpts) {
            opts = opts || {}
            createOpts = createOpts || {}

            return new Promise((resolve, reject) => {
                let newModel = {}

                for (let key in schema) {
                    if (opts.hasOwnProperty(key)) {
                        // If I have a value for this property
                        if (
                            opts[key] != null &&
                            schema[key].type &&
                            schema[key].type === 'ref'
                        ) {
                            // If property is reference, save as a ref
                            newModel[key] = {
                                $ref: opts[key]['$ref'] || opts[key]._id,
                                _type: opts[key]._type,
                            }
                        } else {
                            // otherwise just copy it onto the update
                            newModel[key] = opts[key]
                        }
                    } else {
                        // If I don't have a value for this property
                        if (schema[key].default != null) {
                            // If there is a default value specified in the schema, use it
                            if (typeof schema[key].default === 'function') {
                                newModel[key] = schema[key].default()
                            } else {
                                newModel[key] = schema[key].default
                            }
                        } else if (schema[key].required) {
                            // If the schema states this is required, error
                            throw kyatatsu.errors.missingProperty(name, key)
                        }
                    }
                }

                let id = uuid()
                newModel._id = id
                newModel._type = name

                let keyspaceRef = `${name}:${id}`

                let upsertOpts = {
                    persist_to: createOpts.persistToDisc === true ? 1 : 0,
                }

                const collection = kyatatsu.cluster.bucket(kyatatsu.bucketName).collection()

                collection.upsert(
                    keyspaceRef,
                    newModel,
                    upsertOpts,
                    (err, res) => {
                        if (err) reject(err)

                        collection.get(keyspaceRef, (err, res) => {
                            if (err) reject(err)
                            resolve(res != null ? res.value : null)
                        })
                    }
                )
            })
        }

        return model
    }

    async query(queryString, parameters) {
      return new Promise((resolve, reject) => {
        parameters = parameters || []

        const options = { parameters }

        this.cluster.query(queryString, options, (err, rows) => {
          if (err) {
            if (err.code === 3000) {
              err.info = `Syntax error in N1qlQuery: ${query}`
            }
              reject(err)
          } else {
            resolve(rows)
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

module.exports = new Kyatatsu()
