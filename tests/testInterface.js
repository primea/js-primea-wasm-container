module.exports = function (t) {
  return class TeInterface {
    constructor () {
      this.t = t
    }

    equals (a, b) {
      this.t.equals(a, b)
    }
  }
}
