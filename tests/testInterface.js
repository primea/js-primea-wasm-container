module.exports = function (t) {
  return class TestInterface {
    constructor () {
      this.t = t
    }

    equals (a, b) {
      this.t.equals(a, b)
    }
  }
}
