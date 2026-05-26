const NativeDOMException = globalThis.DOMException || DOMException || class DOMException extends Error {
  constructor(message, name) {
    super(message);
    this.name = name;
  }
};

module.exports = NativeDOMException;
module.exports.default = NativeDOMException;
