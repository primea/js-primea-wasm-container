module.exports = class ReferanceMap {
  constructor () {
    this._map = new Map()
    this._nonce = 0
  }

  add (obj) {
    this._map.set(this._nonce, obj)
    this._nonce++
  }

  get (ref) {
    const obj = this._map.get(ref)
    if (!obj) {
      throw new Error('invalid referance')
    }
    return obj
  }

  delete (obj) {
    return this._map.delete(obj)
  }

  clear () {
    this._map.clear()
  }
}
