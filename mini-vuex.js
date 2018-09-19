(function(root) {
function Store(options = {}) {
    const self = this
    if (root.MiniVue) {
        install(root.MiniVue)
    }

    let plugins = options.plugins? options.plugins : []
    let state = options.state? options.state : {}

    this._actions = Object.create(null)
    this._mutations = Object.create(null)
    this._wrappedGetters = Object.create(null)
    this._modules = new ModuleCollection(options)

    let store = this
    let dispatch = store.dispatch
    let commit = store.commit

    this.dispatch = function(type, payload) {
        return dispatch.call(store, type, payload)
    }
    this.commit = function(type, payload) {
        return commit.call(store, type, payload)
    }
    
    installModule(this, state, this._modules.root)
    resetStoreVM(this, state)
    plugins.forEach(plugin => plugin(self))
}

Store.prototype = {
    commit(type, payload) {
        this._mutations[type].forEach(handler => {
            handler(payload)
        })
    },
    dispatch(type, payload) {
        if (typeof type === 'object' && type.type) {
            payload = type
            type = type.type
        }

        const entry = this._actions[type]
        return entry.length > 1 ? Promise.all(entry.map(handler => handler(payload))) : entry[0](payload)                         
    }
}


const prototypeAccessors = {state: {configurable: true}}

prototypeAccessors.state.get = function() {
    return this._vm._data.$$state
}

prototypeAccessors.state.set = function() {}

Object.defineProperties(Store.prototype, prototypeAccessors)

function ModuleCollection(rawRootModule) {
    this.register([], rawRootModule, false)
}

ModuleCollection.prototype = {
    register(path, rawModule, runtime) {
        if (!runtime) {
            runtime = true
        }
        const newModule = new Module(rawModule, runtime)
        this.root = newModule
    }
}


function installModule(store, rootState, module) {
    let local = module.context = makeLocalContext(store)

    module.forEachMutation(function(mutation, key) {
        registerMutation(store, key, mutation, local)
    })

    module.forEachAction(function(action, key) {
        let handler = action.handler || action
        registerAction(store, key, handler, local)
    })

    module.forEachGetter(function(getter, key) {
        registerGetter(store, key, getter, local)
    })
}

function Module(rawModule, runtime) {
    this.runtime = runtime
    this._children = Object.create(null)
    this._rawModule = rawModule
    const rawState = rawModule.state
    this.state = (typeof rawState === 'function' ? rawState() : rawState) || {}
}

Module.prototype.forEachGetter = function(fn) {
    if (this._rawModule.getters) {
        forEachValue(this._rawModule.getters, fn)
    }
}

Module.prototype.forEachAction = function(fn) {
    if (this._rawModule.actions) {    
        forEachValue(this._rawModule.actions, fn);
    }
}

Module.prototype.forEachMutation = function(fn) {
    if (this._rawModule.mutations) {  
        forEachValue(this._rawModule.mutations, fn)
    }
}

function forEachValue(obj, fn) {
    Object.keys(obj).forEach(function(key) {return fn(obj[key], key)})
}


function makeLocalContext(store) {
    let local = {
        dispatch: store.dispatch,
        commit: store.commit
    }

    Object.defineProperties(local, {
        getters: {
             get() {return store.getters}
        },
        state: {
            get() {return store.state}
        }
    })
    return local
}

function registerMutation(store, type, handler, local) {
    let entry = store._mutations[type] || (store._mutations[type] = [])
    entry.push(function wrappedMutationHandler(payload) {
        handler.call(store, local.state, payload);
    })
}

function registerAction(store, type, handler, local) {
    let entry = store._actions[type] || (store._actions[type] = [])
    entry.push(function wrappedActionHandler(payload, cb) {
        let res = handler.call(store, {
            dispatch: local.dispatch,
            commit: local.commit,
            getters: local.getters,
            state: local.state,
            rootGetters: store.getters,
            rootState: store.state
        }, payload, cb)
        return res
    })
}

function registerGetter(store, type, rawGetter, local) {
    if (store._wrappedGetters[type]) {
        return
    }
    
    store._wrappedGetters[type] = function wrappedGetter(store) {
        return rawGetter(
            local.state, // local state
            local.getters, // local getters
            store.state, // root state
            store.getters // root getters
        )
    }
  
}

function resetStoreVM(store, state, hot) {
    store.getters = {}
    let wrappedGetters = store._wrappedGetters
    let computed = {}
    
    forEachValue(wrappedGetters, (fn, key) => {
        computed[key] = () => fn(store)
        Object.defineProperty(store.getters, key, {
            get() { return store._vm[key]},
            enumerable: true 
        })
    })

    store._vm = new MiniVue({
        data: {
            $$state: state
        },
        computed: computed
    })
    
}

let MiniVue

function install(_MiniVue) {
    if (MiniVue && _MiniVue === MiniVue) {
        return
    }
    MiniVue = _MiniVue
    MiniVue.mixin({init: VuexInit})
}

function VuexInit () {
    const options = this.$options
    if (options.store) {
        this.$store = typeof options.store === 'function'? options.store() : options.store
    } else if (options.parent && options.parent.$store) {
        this.$store = options.parent.$store
    }
}

const MiniVuex  = {
    Store,
    install
}

root.MiniVuex = MiniVuex
})(window)