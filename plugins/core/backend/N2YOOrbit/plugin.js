const router = require("./routes/n2yo");

let setup = {
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/n2yo",
      s.checkHeadersCodeInjection,
      router,
    );
  },
  onceStarted: (s) => {},
  onceSynced: (s) => {},
};

module.exports = setup;
