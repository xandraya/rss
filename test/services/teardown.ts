import { initPG, dropTables } from './db';

module.exports = async () => {
  const CLIENT_PG = await initPG('test');
  await dropTables(CLIENT_PG);
  await CLIENT_PG.end();
}
