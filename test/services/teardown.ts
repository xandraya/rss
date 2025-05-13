import { initPg, dropTables } from './db';

module.exports = async () => {
  const clientPg = await initPg();
  await dropTables(clientPg, true);
}
