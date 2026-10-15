const { loadTestEnvironment } = require('./test-environment');

loadTestEnvironment({ synchronize: false });
require('../dist/main');

