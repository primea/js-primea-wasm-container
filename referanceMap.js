module.exports = class ReferanceMap {
  /**
   * Handle mapping arbitary JS object to ints
   */
  constructor () {
    this._map = new Map()
    this._nonce = 0
  }

  /**
   * Adds an object to the referance map returning an int to be used as a
   * referance
   * @param {*} obj
   * @return {integer}
   */
  add (obj) {
    const nonce = this._nonce
    this._map.set(this._nonce, obj)
    this._nonce++
    return nonce
  }

  /**
   * gets a POJO given a refernce as an int
   * @param {integer} ref
   * @return {*}
   */
  get (ref) {
    const obj = this._map.get(ref)
    if (!obj) {
      throw new Error('invalid referance')
    }
    return obj
  }

  /**
   * deletes an object given a referance as an int
   * @param {integer}
   * @return {boolean} whether or not the object was deleted
   */
  delete (ref) {
    return this._map.delete(ref)
  }

  /**
   * clears the referance map of a objects
   */
  clear () {
    this._map.clear()
  }
}
