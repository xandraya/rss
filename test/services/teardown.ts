import { initPG, dropTables } from './db';

module.exports = async () => {
  const clientPg = await initPG('test');
  await dropTables(clientPg);
  await clientPg.end();
}
