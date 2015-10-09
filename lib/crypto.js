// Nodejs encryption with CTR
var crypto = require('crypto'),
  algorithm = 'aes-256-ctr';

module.exports = function(cryptoPassword) {
  return {
    encrypt: function(text) {
      var cipher = crypto.createCipher(algorithm, cryptoPassword);
      var crypted = cipher.update(text, 'utf8', 'hex');
      crypted += cipher.final('hex');
      return crypted;
    },
    decrypt: function(text) {
      var decipher = crypto.createDecipher(algorithm, cryptoPassword);
      var dec = decipher.update(text, 'hex', 'utf8');
      dec += decipher.final('utf8');
      return dec;
    }
  };
};
