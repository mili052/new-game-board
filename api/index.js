const { handleApi } = require("../src/api");

module.exports = async function handler(req, res) {
  await handleApi(req, res);
};
