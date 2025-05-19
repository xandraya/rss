import { initPg, dropTables } from './db';

module.exports = async () => {
  const clientPg = await initPg('test');
  await dropTables(clientPg);
  await clientPg.end();
}
